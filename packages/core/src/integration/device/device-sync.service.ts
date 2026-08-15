import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import { CardActions } from "@true-recall/core/persistence/sqlite/modules/CardActions";
import { NoteActions } from "@true-recall/core/persistence/sqlite/modules/NoteActions";
import { NoteTypeActions } from "@true-recall/core/persistence/sqlite/modules/NoteTypeActions";
import { StatsActions } from "@true-recall/core/persistence/sqlite/modules/StatsActions";
import { SqliteDatabase } from "@true-recall/core/persistence/sqlite/SqliteDatabase";
import { CURRENT_SCHEMA_VERSION } from "@true-recall/core/persistence/sqlite/SqliteSchemaManager";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FsrsReplayService } from "@true-recall/core/services/fsrs/fsrs-replay.service";

import type { DeviceDiscoveryService } from "./device-discovery.service";

interface SyncResult {
	devicesFound: number;
	cardsApplied: number;
	reviewLogsApplied: number;
	conflictsReplayed: number;
	duplicatesMerged: number;
	errors: string[];
}

export interface DeviceSyncOptions {
	/** Day boundary hour for rebuilding daily stats (defaults to 4, like Anki). */
	getDayStartHour?: () => number;
	/**
	 * When present, cards reviewed on both devices in the divergence window
	 * are resolved by replaying FSRS over the merged review log instead of
	 * row-level last-write-wins, so neither device's review is lost.
	 */
	replayService?: FsrsReplayService;
}

export class DeviceSyncService {
	constructor(
		private localStore: SqliteStoreService,
		private discovery: DeviceDiscoveryService,
		private persistence: IPersistence,
		private options: DeviceSyncOptions = {},
	) {}

	async syncOnStartup(): Promise<SyncResult> {
		const result: SyncResult = {
			devicesFound: 0,
			cardsApplied: 0,
			reviewLogsApplied: 0,
			conflictsReplayed: 0,
			duplicatesMerged: 0,
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
				result.conflictsReplayed += merged.conflicts;
			} catch (err) {
				const msg = `Sync from ${remote.deviceId} failed: ${err instanceof Error ? err.message : String(err)}`;
				console.error(`[True Recall] ${msg}`);
				result.errors.push(msg);
			}
		}

		if (result.cardsApplied > 0) {
			try {
				result.duplicatesMerged = this.dedupeConcurrentCreates();
			} catch (err) {
				const msg = `Failed to dedupe concurrent creates: ${err instanceof Error ? err.message : String(err)}`;
				console.error(`[True Recall] ${msg}`);
				result.errors.push(msg);
			}
		}

		if (result.cardsApplied > 0 || result.reviewLogsApplied > 0) {
			try {
				this.localStore.stats.rebuildDailyStatsFromReviewLog(
					this.options.getDayStartHour?.(),
				);
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
	): Promise<{ cards: number; reviewLogs: number; conflicts: number }> {
		const data = await this.persistence.readBinary(remotePath);
		if (!data || data.byteLength === 0) {
			console.warn(
				`[True Recall] Remote database at ${remotePath} is empty or unreadable, skipping sync`,
			);
			return { cards: 0, reviewLogs: 0, conflicts: 0 };
		}

		const remoteDb = new SqliteDatabase(() => {});
		await remoteDb.init(new Uint8Array(data));

		try {
			const remoteVersionRow = remoteDb.get<{ value: string }>(
				`SELECT value FROM meta WHERE key = 'schema_version'`,
			);
			const remoteVersion = Number(remoteVersionRow?.value ?? "1");
			if (remoteVersion > CURRENT_SCHEMA_VERSION) {
				throw new Error(
					`remote schema v${remoteVersion} is newer than local v${CURRENT_SCHEMA_VERSION}; update the plugin on this device first`,
				);
			}

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
			let conflictsReplayed = 0;

			// Cards this device reviewed in the divergence window: if the remote
			// also contributed reviews for one of them, neither side's card row
			// is authoritative and the state must be replayed from both logs.
			const locallyReviewed = this.options.replayService
				? new Set(this.localStore.stats.getReviewedCardIdsSince(lastSync))
				: new Set<string>();
			const conflictedCardIds = new Set<string>();

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
						if (
							log.deletedAt == null &&
							log.reviewKind !== "preview" &&
							locallyReviewed.has(log.cardId)
						) {
							conflictedCardIds.add(log.cardId);
						}
					}
					observe(log.updatedAt);
				}

				conflictsReplayed = this.replayConflictedCards(conflictedCardIds);

				this.localStore.cards.setSyncMetadata(syncKey, String(maxObserved));
			});

			if (cardsApplied > 0 || reviewLogsApplied > 0) {
				console.debug(
					`[True Recall] Synced from ${remoteDeviceId}: ${cardsApplied} cards, ${reviewLogsApplied} review logs, ${conflictsReplayed} conflicts replayed`,
				);
			}

			return {
				cards: cardsApplied,
				reviewLogs: reviewLogsApplied,
				conflicts: conflictsReplayed,
			};
		} finally {
			remoteDb.close();
		}
	}

	/**
	 * Converge cards created concurrently from the same note block on two
	 * devices. Identity key: (source_uid, template_ord, fields_json). The
	 * earliest-created card (ties broken by id) survives on every device, so
	 * all replicas pick the same winner; losers are tombstoned and their
	 * review history is reattached to the survivor.
	 */
	private dedupeConcurrentCreates(): number {
		const rows = this.localStore.cards.getActiveDedupRows();
		const groups = new Map<string, typeof rows>();
		for (const row of rows) {
			const key = `${row.sourceUid}|${row.templateOrd}|${row.fieldsJson}`;
			const group = groups.get(key);
			if (group) {
				group.push(row);
			} else {
				groups.set(key, [row]);
			}
		}

		let merged = 0;
		this.localStore.transaction(() => {
			for (const group of groups.values()) {
				if (group.length < 2) continue;
				const sorted = [...group].sort(
					(a, b) =>
						(a.createdAt ?? 0) - (b.createdAt ?? 0) ||
						a.id.localeCompare(b.id),
				);
				const survivor = sorted[0];
				if (!survivor) continue;
				for (const loser of sorted.slice(1)) {
					this.localStore.stats.reassignCardReviews(loser.id, survivor.id);
					this.localStore.cards.softDelete(loser.id);
					merged++;
				}

				// The survivor may have gained review history; recompute its state
				// from the merged log when replay is available.
				const replayService = this.options.replayService;
				if (replayService) {
					const state = replayService.replayCard(
						survivor.id,
						this.localStore.stats.getReplayLogsForCard(survivor.id),
					);
					if (state) {
						this.localStore.cards.applyReplayedScheduling(survivor.id, state);
					}
				}
			}
		});
		return merged;
	}

	/**
	 * Recompute scheduling for cards reviewed on both devices by replaying
	 * FSRS over the merged review history. Runs inside the merge transaction.
	 */
	private replayConflictedCards(cardIds: Set<string>): number {
		const replayService = this.options.replayService;
		if (!replayService || cardIds.size === 0) return 0;

		let replayed = 0;
		for (const cardId of cardIds) {
			const logs = this.localStore.stats.getReplayLogsForCard(cardId);
			const state = replayService.replayCard(cardId, logs);
			if (!state) continue;
			this.localStore.cards.applyReplayedScheduling(cardId, state);
			replayed++;
		}
		return replayed;
	}
}
