import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import { CardActions } from "@true-recall/core/persistence/sqlite/modules/CardActions";
import { StatsActions } from "@true-recall/core/persistence/sqlite/modules/StatsActions";
import { SqliteDatabase } from "@true-recall/core/persistence/sqlite/SqliteDatabase";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { DeviceDiscoveryService } from "./device-discovery.service";

export interface SyncResult {
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
			return { cards: 0, reviewLogs: 0 };
		}

		const remoteDb = new SqliteDatabase(() => {});
		await remoteDb.init(new Uint8Array(data));

		try {
			const remoteCards = new CardActions(remoteDb);
			const remoteStats = new StatsActions(remoteDb);

			const syncKey = `sync:${remoteDeviceId}`;
			const lastSyncStr = this.localStore.cards.getSyncMetadata(syncKey);
			const lastSync = lastSyncStr ? Number(lastSyncStr) : 0;

			const modifiedCards = remoteCards.getModifiedSince(lastSync);
			const modifiedLogs = remoteStats.getModifiedReviewLogSince(lastSync);

			let cardsApplied = 0;
			const localCards = this.localStore.cards;
			for (const card of modifiedCards) {
				if (localCards.upsertFromRemote(card)) {
					cardsApplied++;
				}
			}

			let reviewLogsApplied = 0;
			const localStats = this.localStore.stats;
			for (const log of modifiedLogs) {
				if (localStats.upsertReviewLogFromRemote(log)) {
					reviewLogsApplied++;
				}
			}

			localCards.setSyncMetadata(syncKey, String(Date.now()));

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
