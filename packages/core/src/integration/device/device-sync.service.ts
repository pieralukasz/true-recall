import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import { CardActions } from "@true-recall/core/persistence/sqlite/modules/CardActions";
import { NoteActions } from "@true-recall/core/persistence/sqlite/modules/NoteActions";
import { NoteTypeActions } from "@true-recall/core/persistence/sqlite/modules/NoteTypeActions";
import { StatsActions } from "@true-recall/core/persistence/sqlite/modules/StatsActions";
import { SqliteDatabase } from "@true-recall/core/persistence/sqlite/SqliteDatabase";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";

import type { DeviceDiscoveryService } from "./device-discovery.service";

interface SyncResult {
	devicesFound: number;
	cardsApplied: number;
	reviewLogsApplied: number;
	errors: string[];
}

export class DeviceSyncService {
	constructor(
		private localStore: SqliteStoreService,
		private discovery: DeviceDiscoveryService,
		private persistence: IPersistence,
	) {}

	async syncOnStartup(): Promise<SyncResult> {
		const result: SyncResult = {
			devicesFound: 0,
			cardsApplied: 0,
			reviewLogsApplied: 0,
			errors: [],
		};

		let devices: Awaited<
			ReturnType<DeviceDiscoveryService["discoverDeviceDatabases"]>
		>;
		try {
			devices = await this.discovery.discoverDeviceDatabases();
		} catch (err) {
			result.errors.push(
				`Failed to discover devices: ${err instanceof Error ? err.message : String(err)}`,
			);
			return result;
		}

		const remoteDevices = devices.filter((d) => !d.isCurrentDevice);
		result.devicesFound = remoteDevices.length;

		if (remoteDevices.length === 0) return result;

		for (const remote of remoteDevices) {
			try {
				const merged = await this.mergeFromRemote(remote.deviceId, remote.path);
				result.cardsApplied += merged.cards;
				result.reviewLogsApplied += merged.reviewLogs;
			} catch (err) {
				const msg = `Sync from ${remote.deviceId} failed: ${err instanceof Error ? err.message : String(err)}`;
				console.error(`[True Recall] ${msg}`);
				result.errors.push(msg);
			}
		}

		if (result.cardsApplied > 0 || result.reviewLogsApplied > 0) {
			try {
				this.localStore.stats.rebuildDailyStatsFromReviewLog();
			} catch (err) {
				const msg = `Failed to rebuild stats: ${err instanceof Error ? err.message : String(err)}`;
				console.error(`[True Recall] ${msg}`);
				result.errors.push(msg);
			}
		}

		return result;
	}

	private async mergeFromRemote(
		remoteDeviceId: string,
		remotePath: string,
	): Promise<{ cards: number; reviewLogs: number }> {
		const data = await this.persistence.readBinary(remotePath);
		if (!data || data.byteLength === 0) {
			console.warn(
				`[True Recall] Remote database at ${remotePath} is empty or unreadable, skipping sync`,
			);
			return { cards: 0, reviewLogs: 0 };
		}

		const remoteDb = new SqliteDatabase(() => {});
		await remoteDb.init(new Uint8Array(data));

		try {
			const remoteCards = new CardActions(remoteDb);
			const remoteStats = new StatsActions(remoteDb);
			const remoteNotes = new NoteActions(remoteDb);
			const remoteNoteTypes = new NoteTypeActions(remoteDb);

			const syncKey = `sync:${remoteDeviceId}`;
			const lastSyncStr = this.localStore.cards.getSyncMetadata(syncKey);
			const lastSync = lastSyncStr ? Number(lastSyncStr) : 0;

			const modifiedNoteTypes =
				remoteNoteTypes.getRawRowsModifiedSince(lastSync);
			const modifiedNotes = remoteNotes.getRawRowsModifiedSince(lastSync);
			const modifiedCards = remoteCards.getModifiedSince(lastSync);
			const modifiedLogs = remoteStats.getModifiedReviewLogSince(lastSync);

			// Cards FK-reference notes and notes FK-reference note types; a
			// referenced row can predate the watermark on the remote while
			// still being unknown locally — fetch those regardless of time.
			const knownNoteIds = new Set(modifiedNotes.map((n) => n.id));
			const missingNoteIds = [
				...new Set(
					modifiedCards
						.map((c) => c.noteId)
						.filter(
							(id): id is string =>
								!!id &&
								!knownNoteIds.has(id) &&
								!this.localStore.notes.hasRow(id),
						),
				),
			];
			const backfillNotes = remoteNotes.getRawRowsByIds(missingNoteIds);

			const allNotes = [...modifiedNotes, ...backfillNotes];
			const knownTypeIds = new Set(modifiedNoteTypes.map((t) => t.id));
			const missingTypeIds = [
				...new Set(
					allNotes
						.map((n) => n.note_type_id)
						.filter(
							(id) =>
								!knownTypeIds.has(id) && !this.localStore.noteTypes.hasRow(id),
						),
				),
			];
			const backfillTypes = remoteNoteTypes.getRawRowsByIds(missingTypeIds);

			// The sync watermark must reflect the remote rows actually seen,
			// not the local wall clock — file sync (iCloud/git) delivers
			// remote DBs late, and a Date.now() watermark skipped those rows
			// forever on the next pass.
			let maxObserved = lastSync;
			const observe = (ts: number | null | undefined) => {
				if (typeof ts === "number" && ts > maxObserved) maxObserved = ts;
			};

			let cardsApplied = 0;
			let reviewLogsApplied = 0;

			// One transaction: a failure mid-merge must not leave cards
			// without their notes (FK) or advance the watermark.
			this.localStore.transaction(() => {
				for (const row of [...modifiedNoteTypes, ...backfillTypes]) {
					this.localStore.noteTypes.upsertRowFromRemote(row);
					observe(row.updated_at);
				}
				for (const row of allNotes) {
					this.localStore.notes.upsertRowFromRemote(row);
					observe(row.updated_at);
				}
				for (const card of modifiedCards) {
					if (this.localStore.cards.upsertFromRemote(card)) {
						cardsApplied++;
					}
					observe(card.updatedAt);
				}
				for (const log of modifiedLogs) {
					if (this.localStore.stats.upsertReviewLogFromRemote(log)) {
						reviewLogsApplied++;
					}
					observe(log.updatedAt);
				}

				this.localStore.cards.setSyncMetadata(syncKey, String(maxObserved));
			});

			if (cardsApplied > 0 || reviewLogsApplied > 0) {
				console.debug(
					`[True Recall] Synced from ${remoteDeviceId}: ${cardsApplied} cards, ${reviewLogsApplied} review logs`,
				);
			}

			return { cards: cardsApplied, reviewLogs: reviewLogsApplied };
		} finally {
			remoteDb.close();
		}
	}
}
