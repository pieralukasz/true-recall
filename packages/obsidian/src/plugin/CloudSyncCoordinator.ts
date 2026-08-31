import { signal } from "@preact/signals";

import type { CloudSyncResult } from "@true-recall/core/integration/cloud/cloud-sync.types";

export type CloudSyncTrigger =
	| "startup"
	| "change"
	| "foreground"
	| "interval"
	| "manual";

export class CloudSyncCoordinator {
	readonly lastSyncedAt = signal<number | null>(null);
	readonly lastError = signal<string | null>(null);
	readonly isSyncing = signal(false);
	private inFlight: Promise<CloudSyncResult | null> | null = null;
	private lastForegroundAt = 0;

	constructor(private readonly runSync: () => Promise<CloudSyncResult>) {}

	syncNow(trigger: CloudSyncTrigger): Promise<CloudSyncResult | null> {
		if (this.inFlight) return this.inFlight;
		if (trigger === "foreground") {
			const now = Date.now();
			if (now - this.lastForegroundAt < 10_000) return Promise.resolve(null);
			this.lastForegroundAt = now;
		}
		this.inFlight = this.run(trigger);
		return this.inFlight;
	}

	private async run(
		trigger: CloudSyncTrigger,
	): Promise<CloudSyncResult | null> {
		this.isSyncing.value = true;
		try {
			const result = await this.runSync();
			if (result.errors.length > 0) {
				this.lastError.value = result.errors.join("; ");
			} else {
				this.lastSyncedAt.value = Date.now();
				this.lastError.value = null;
			}
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.lastError.value = message;
			console.warn(`[True Recall] Cloud sync (${trigger}) failed:`, error);
			return null;
		} finally {
			this.isSyncing.value = false;
			this.inFlight = null;
		}
	}
}
