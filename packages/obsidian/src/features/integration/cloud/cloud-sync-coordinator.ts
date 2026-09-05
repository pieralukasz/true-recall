import { signal } from "@preact/signals";

import { describeErrorForUser } from "@true-recall/core/errors";
import type { CloudSyncResult } from "@true-recall/core/integration/cloud/cloud-sync.types";

import { reportError } from "@true-recall/obsidian/services/errors";

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
				const error = new Error(result.errors.join("; "));
				this.lastError.value = describeErrorForUser(error);
				reportError(error, {
					origin: "cloud-sync",
					context: { trigger, partial: true },
				});
			} else {
				this.lastSyncedAt.value = Date.now();
				this.lastError.value = null;
			}
			return result;
		} catch (error) {
			this.lastError.value = describeErrorForUser(error);
			reportError(error, { origin: "cloud-sync", context: { trigger } });
			return null;
		} finally {
			this.isSyncing.value = false;
			this.inFlight = null;
		}
	}
}
