import { signal } from "@preact/signals";

import type { SyncResult } from "@true-recall/core/integration/device/device-sync.service";

export type SyncTrigger = "startup" | "foreground" | "interval" | "manual";

export interface CrossDeviceSyncCoordinatorDeps {
	/** Run one merge pass over all remote device databases. */
	runSync: () => Promise<SyncResult>;
	/** Flush local writes to disk so the merge sees the freshest state. */
	flushLocal: () => Promise<unknown>;
	/** Invoked after a sync that applied at least one change (invalidate UI). */
	onChangesApplied: (result: SyncResult) => void;
}

/** Ignore foreground triggers that fire in rapid succession (tab switches). */
const FOREGROUND_MIN_INTERVAL_MS = 10_000;

export function emptySyncResult(): SyncResult {
	return {
		devicesFound: 0,
		cardsApplied: 0,
		reviewLogsApplied: 0,
		conflictsReplayed: 0,
		duplicatesMerged: 0,
		errors: [],
	};
}

export function countAppliedChanges(result: SyncResult): number {
	return (
		result.cardsApplied +
		result.reviewLogsApplied +
		result.conflictsReplayed +
		result.duplicatesMerged
	);
}

/**
 * Single entry point for every cross-device sync trigger: startup, app
 * returning to the foreground (mobile apps resume without reloading the
 * plugin, so onload-only sync goes stale), the background scheduler, and
 * the manual "Sync devices now" command. Runs are serialized: a trigger
 * arriving while a sync is in flight joins that run instead of racing it.
 */
export class CrossDeviceSyncCoordinator {
	/** Epoch ms of the last completed sync (null before the first one). */
	readonly lastSyncedAt = signal<number | null>(null);
	readonly lastError = signal<string | null>(null);
	readonly isSyncing = signal(false);

	private inFlight: Promise<SyncResult | null> | null = null;
	private lastForegroundAttemptAt = 0;

	constructor(private readonly deps: CrossDeviceSyncCoordinatorDeps) {}

	syncNow(trigger: SyncTrigger): Promise<SyncResult | null> {
		if (this.inFlight) return this.inFlight;

		if (trigger === "foreground") {
			const now = Date.now();
			if (now - this.lastForegroundAttemptAt < FOREGROUND_MIN_INTERVAL_MS) {
				return Promise.resolve(null);
			}
			this.lastForegroundAttemptAt = now;
		}

		this.inFlight = this.run(trigger);
		return this.inFlight;
	}

	private async run(trigger: SyncTrigger): Promise<SyncResult | null> {
		this.isSyncing.value = true;
		try {
			await this.deps.flushLocal();
			const result = await this.deps.runSync();
			this.lastSyncedAt.value = Date.now();
			this.lastError.value =
				result.errors.length > 0 ? result.errors.join("; ") : null;
			if (countAppliedChanges(result) > 0) {
				this.deps.onChangesApplied(result);
			}
			return result;
		} catch (err) {
			this.lastError.value = err instanceof Error ? err.message : String(err);
			console.warn(`[True Recall] Device sync (${trigger}) failed:`, err);
			return null;
		} finally {
			this.isSyncing.value = false;
			this.inFlight = null;
		}
	}
}
