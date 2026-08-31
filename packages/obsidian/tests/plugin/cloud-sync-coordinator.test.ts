import { describe, expect, it, vi } from "vitest";

import { CloudSyncCoordinator } from "@true-recall/obsidian/plugin/CloudSyncCoordinator";

const emptyResult = () => ({
	pulled: 0,
	pushed: 0,
	cardIdsChanged: [],
	reviewLogsApplied: 0,
	conflictsReplayed: 0,
	duplicatesMerged: 0,
	errors: [],
});

describe("CloudSyncCoordinator", () => {
	it("joins concurrent triggers instead of racing sync runs", async () => {
		let release: (() => void) | undefined;
		const run = vi.fn(
			() =>
				new Promise<ReturnType<typeof emptyResult>>((resolve) => {
					release = () => resolve(emptyResult());
				}),
		);
		const coordinator = new CloudSyncCoordinator(run);

		const first = coordinator.syncNow("change");
		const second = coordinator.syncNow("interval");
		expect(first).toBe(second);
		expect(run).toHaveBeenCalledOnce();
		release?.();
		await first;
		expect(coordinator.isSyncing.value).toBe(false);
	});

	it("does not report a failed exchange as successfully synced", async () => {
		const coordinator = new CloudSyncCoordinator(async () => ({
			...emptyResult(),
			errors: ["offline"],
		}));

		await coordinator.syncNow("manual");

		expect(coordinator.lastSyncedAt.value).toBeNull();
		expect(coordinator.lastError.value).toBe("offline");
	});
});
