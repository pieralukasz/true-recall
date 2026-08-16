import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncResult } from "@true-recall/core/integration/device/device-sync.service";

import {
	countAppliedChanges,
	CrossDeviceSyncCoordinator,
	emptySyncResult,
} from "@true-recall/obsidian/plugin/CrossDeviceSyncCoordinator";

function resultWith(partial: Partial<SyncResult>): SyncResult {
	return { ...emptySyncResult(), ...partial };
}

describe("CrossDeviceSyncCoordinator", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-16T10:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function createCoordinator(opts?: {
		result?: SyncResult;
		runSync?: () => Promise<SyncResult>;
	}) {
		const flushLocal = vi.fn(async () => {});
		const onChangesApplied = vi.fn();
		const runSync = vi.fn(
			opts?.runSync ?? (async () => opts?.result ?? emptySyncResult()),
		);
		const coordinator = new CrossDeviceSyncCoordinator({
			runSync,
			flushLocal,
			onChangesApplied,
		});
		return { coordinator, flushLocal, onChangesApplied, runSync };
	}

	it("flushes local changes before merging", async () => {
		const order: string[] = [];
		const flushLocal = vi.fn(async () => {
			order.push("flush");
		});
		const runSync = vi.fn(async () => {
			order.push("sync");
			return emptySyncResult();
		});
		const coordinator = new CrossDeviceSyncCoordinator({
			runSync,
			flushLocal,
			onChangesApplied: vi.fn(),
		});

		await coordinator.syncNow("manual");
		expect(order).toEqual(["flush", "sync"]);
	});

	it("serializes concurrent triggers into a single run", async () => {
		let resolveSync: (r: SyncResult) => void = () => {};
		const { coordinator, runSync } = createCoordinator({
			runSync: () =>
				new Promise<SyncResult>((resolve) => {
					resolveSync = resolve;
				}),
		});

		const first = coordinator.syncNow("startup");
		const second = coordinator.syncNow("manual");
		expect(second).toBe(first);
		// runSync starts after the awaited flushLocal microtask resolves.
		await vi.advanceTimersByTimeAsync(0);
		expect(runSync).toHaveBeenCalledTimes(1);

		resolveSync(emptySyncResult());
		await first;
	});

	it("invalidates UI only when changes were applied", async () => {
		const { coordinator, onChangesApplied } = createCoordinator({
			result: resultWith({ cardsApplied: 0 }),
		});
		await coordinator.syncNow("interval");
		expect(onChangesApplied).not.toHaveBeenCalled();

		const applied = createCoordinator({
			result: resultWith({ reviewLogsApplied: 3 }),
		});
		await applied.coordinator.syncNow("interval");
		expect(applied.onChangesApplied).toHaveBeenCalledTimes(1);
	});

	it("records lastSyncedAt and clears it not on failure", async () => {
		const failing = createCoordinator({
			runSync: async () => {
				throw new Error("disk gone");
			},
		});
		const result = await failing.coordinator.syncNow("manual");
		expect(result).toBeNull();
		expect(failing.coordinator.lastSyncedAt.value).toBeNull();
		expect(failing.coordinator.lastError.value).toBe("disk gone");

		const ok = createCoordinator({ result: emptySyncResult() });
		await ok.coordinator.syncNow("manual");
		expect(ok.coordinator.lastSyncedAt.value).toBe(Date.now());
		expect(ok.coordinator.lastError.value).toBeNull();
	});

	it("debounces foreground triggers within 10 seconds", async () => {
		const { coordinator, runSync } = createCoordinator();

		await coordinator.syncNow("foreground");
		expect(runSync).toHaveBeenCalledTimes(1);

		await coordinator.syncNow("foreground");
		expect(runSync).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(10_001);
		await coordinator.syncNow("foreground");
		expect(runSync).toHaveBeenCalledTimes(2);
	});

	it("does not debounce manual or interval triggers", async () => {
		const { coordinator, runSync } = createCoordinator();
		await coordinator.syncNow("manual");
		await coordinator.syncNow("interval");
		await coordinator.syncNow("manual");
		expect(runSync).toHaveBeenCalledTimes(3);
	});
});

describe("countAppliedChanges", () => {
	it("sums all applied change kinds", () => {
		expect(
			countAppliedChanges(
				resultWith({
					cardsApplied: 1,
					reviewLogsApplied: 2,
					conflictsReplayed: 3,
					duplicatesMerged: 4,
				}),
			),
		).toBe(10);
		expect(countAppliedChanges(emptySyncResult())).toBe(0);
	});
});
