/**
 * Device Sync Scheduler
 *
 * Background companion to DeviceSyncService: polls the mtimes of other
 * devices' database files and runs a merge only when one actually changed,
 * so reviews done on the phone show up on the desktop without a plugin
 * restart. Polling stat() is cheap; the expensive binary read happens only
 * on a detected change, and the merge itself is watermark-guarded and
 * idempotent.
 */

import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import {
	DB_FOLDER,
	extractDeviceIdFromFilename,
} from "@true-recall/core/persistence/sqlite/sqlite.types";

import type { SyncResult } from "./device-sync.service";

const DEFAULT_INTERVAL_MS = 60_000;

export interface DeviceSyncSchedulerOptions {
	intervalMs?: number;
	/** Invoked after a background merge that applied at least one change. */
	onChanges?: (result: SyncResult) => void;
}

export class DeviceSyncScheduler {
	private timer: number | null = null;
	private isTickRunning = false;
	private lastSeenMtimes = new Map<string, number>();

	constructor(
		private persistence: IPersistence,
		private currentDeviceId: string,
		private runSync: () => Promise<SyncResult>,
		private options: DeviceSyncSchedulerOptions = {},
	) {}

	/** Record current remote mtimes as the baseline, then start polling. */
	async start(): Promise<void> {
		this.stop();
		try {
			await this.collectChangedRemotes();
		} catch (err) {
			console.debug("[True Recall] Sync scheduler priming failed:", err);
		}
		this.timer = window.setInterval(() => {
			void this.tick();
		}, this.options.intervalMs ?? DEFAULT_INTERVAL_MS);
	}

	stop(): void {
		if (this.timer) {
			window.clearInterval(this.timer);
			this.timer = null;
		}
	}

	private async tick(): Promise<void> {
		if (this.isTickRunning) return;
		this.isTickRunning = true;
		try {
			const changed = await this.collectChangedRemotes();
			if (changed === 0) return;

			const result = await this.runSync();
			const applied =
				result.cardsApplied +
				result.reviewLogsApplied +
				result.conflictsReplayed +
				result.duplicatesMerged;
			if (applied > 0) {
				this.options.onChanges?.(result);
			}
		} catch (err) {
			console.warn("[True Recall] Background device sync failed:", err);
		} finally {
			this.isTickRunning = false;
		}
	}

	/**
	 * Stat every remote device database and count the ones whose mtime moved
	 * since the last observation (new files count as changed).
	 */
	private async collectChangedRemotes(): Promise<number> {
		const folderExists = await this.persistence.exists(DB_FOLDER);
		if (!folderExists) return 0;

		const items = await this.persistence.list(DB_FOLDER);
		let changed = 0;
		for (const filePath of items.files) {
			const filename = filePath.split("/").pop() ?? "";
			const deviceId = extractDeviceIdFromFilename(filename);
			if (!deviceId || deviceId === this.currentDeviceId) continue;

			const stat = await this.persistence.stat(filePath);
			if (!stat) continue;

			if (this.lastSeenMtimes.get(filePath) !== stat.mtime) {
				changed++;
				this.lastSeenMtimes.set(filePath, stat.mtime);
			}
		}
		return changed;
	}
}
