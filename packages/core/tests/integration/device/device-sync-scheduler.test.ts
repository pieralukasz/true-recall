/**
 * DeviceSyncScheduler Tests
 * Background merge must trigger only when a remote device database actually
 * changed on disk, never overlap itself, and stop cleanly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncResult } from "../../../src/integration/device/device-sync.service";
import { DeviceSyncScheduler } from "../../../src/integration/device/device-sync-scheduler";
import type { IPersistence } from "../../../src/interfaces/persistence";

function emptyResult(): SyncResult {
	return {
		devicesFound: 0,
		cardsApplied: 0,
		cardIdsChanged: [],
		reviewLogsApplied: 0,
		conflictsReplayed: 0,
		duplicatesMerged: 0,
		errors: [],
	};
}

class StatMockPersistence implements IPersistence {
	files = new Map<string, { mtime: number }>();

	async read(): Promise<string> {
		throw new Error("not used");
	}
	async rename(): Promise<void> {
		throw new Error("not used");
	}
	async readBinary(): Promise<Uint8Array | null> {
		return null;
	}
	async writeBinary(): Promise<void> {}
	async exists(path: string): Promise<boolean> {
		return path === ".true-recall" || this.files.has(path);
	}
	async mkdir(): Promise<void> {}
	async list(): Promise<{ files: string[]; folders: string[] }> {
		return { files: [...this.files.keys()], folders: [] };
	}
	async remove(path: string): Promise<void> {
		this.files.delete(path);
	}
	async stat(path: string): Promise<{ size: number; mtime: number } | null> {
		const entry = this.files.get(path);
		return entry ? { size: 1024, mtime: entry.mtime } : null;
	}
}

describe("DeviceSyncScheduler", () => {
	let persistence: StatMockPersistence;
	let runSync: ReturnType<typeof vi.fn>;
	let scheduler: DeviceSyncScheduler;

	beforeEach(() => {
		vi.useFakeTimers();
		persistence = new StatMockPersistence();
		persistence.files.set(".true-recall/true-recall-remote01.db", {
			mtime: 1000,
		});
		runSync = vi.fn(async () => emptyResult());
		scheduler = new DeviceSyncScheduler(persistence, "local001", runSync, {
			intervalMs: 60_000,
		});
	});

	afterEach(() => {
		scheduler.stop();
		vi.useRealTimers();
	});

	it("does not sync while remote databases are unchanged", async () => {
		await scheduler.start();

		await vi.advanceTimersByTimeAsync(180_000);

		expect(runSync).not.toHaveBeenCalled();
	});

	it("syncs once when a remote database mtime changes", async () => {
		await scheduler.start();

		persistence.files.set(".true-recall/true-recall-remote01.db", {
			mtime: 2000,
		});
		await vi.advanceTimersByTimeAsync(60_000);

		expect(runSync).toHaveBeenCalledTimes(1);

		// unchanged afterwards: no further syncs
		await vi.advanceTimersByTimeAsync(120_000);
		expect(runSync).toHaveBeenCalledTimes(1);
	});

	it("syncs when a new remote device database appears", async () => {
		await scheduler.start();

		persistence.files.set(".true-recall/true-recall-newdev02.db", {
			mtime: 500,
		});
		await vi.advanceTimersByTimeAsync(60_000);

		expect(runSync).toHaveBeenCalledTimes(1);
	});

	it("ignores the current device's own database", async () => {
		await scheduler.start();

		persistence.files.set(".true-recall/true-recall-local001.db", {
			mtime: 99999,
		});
		await vi.advanceTimersByTimeAsync(60_000);

		expect(runSync).not.toHaveBeenCalled();
	});

	it("reports applied changes through onChanges", async () => {
		const onChanges = vi.fn();
		runSync.mockResolvedValue({ ...emptyResult(), cardsApplied: 2 });
		scheduler = new DeviceSyncScheduler(persistence, "local001", runSync, {
			intervalMs: 60_000,
			onChanges,
		});
		await scheduler.start();

		persistence.files.set(".true-recall/true-recall-remote01.db", {
			mtime: 2000,
		});
		await vi.advanceTimersByTimeAsync(60_000);

		expect(onChanges).toHaveBeenCalledWith(
			expect.objectContaining({ cardsApplied: 2 }),
		);
	});

	it("stop prevents any further syncs", async () => {
		await scheduler.start();
		scheduler.stop();

		persistence.files.set(".true-recall/true-recall-remote01.db", {
			mtime: 2000,
		});
		await vi.advanceTimersByTimeAsync(600_000);

		expect(runSync).not.toHaveBeenCalled();
	});
});
