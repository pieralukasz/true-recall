import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";

import type { DataLayer } from "@true-recall/obsidian/data";
import { G } from "@true-recall/obsidian/data";
import { DayRolloverWatcher } from "@true-recall/obsidian/plugin/DayRolloverWatcher";

const ROLLOVER_GROUPS = [G.CARDS, G.DASHBOARD, G.PANEL, G.REVIEW, G.STATS];

function makeDataLayerMock(): DataLayer & {
	invalidateGroups: ReturnType<typeof vi.fn>;
} {
	return {
		invalidateGroups: vi.fn(),
	} as unknown as DataLayer & {
		invalidateGroups: ReturnType<typeof vi.fn>;
	};
}

describe("DayRolloverWatcher", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-21T10:00:00"));
		vi.stubGlobal("window", {});
		vi.stubGlobal("document", { visibilityState: "visible" });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("does nothing when checked within the same day", () => {
		const dl = makeDataLayerMock();
		const watcher = new DayRolloverWatcher(new DayBoundaryService(4), dl);

		watcher.check(new Date("2026-04-21T15:30:00"));

		expect(dl.invalidateGroups).not.toHaveBeenCalled();
	});

	it("invalidates rollover groups when the day key changes", () => {
		const dl = makeDataLayerMock();
		const watcher = new DayRolloverWatcher(new DayBoundaryService(4), dl);

		watcher.check(new Date("2026-04-22T04:01:00"));

		expect(dl.invalidateGroups).toHaveBeenCalledOnce();
		expect(dl.invalidateGroups).toHaveBeenCalledWith(ROLLOVER_GROUPS);
	});

	it("invalidates only once per rollover even if checked repeatedly", () => {
		const dl = makeDataLayerMock();
		const watcher = new DayRolloverWatcher(new DayBoundaryService(4), dl);

		watcher.check(new Date("2026-04-22T04:01:00"));
		watcher.check(new Date("2026-04-22T04:02:00"));
		watcher.check(new Date("2026-04-22T08:00:00"));

		expect(dl.invalidateGroups).toHaveBeenCalledOnce();
	});

	it("does not invalidate at the pre-dayStartHour edge (3:59 still 'yesterday')", () => {
		vi.setSystemTime(new Date("2026-04-21T05:00:00"));
		const dl = makeDataLayerMock();
		const watcher = new DayRolloverWatcher(new DayBoundaryService(4), dl);

		watcher.check(new Date("2026-04-22T03:59:59"));

		expect(dl.invalidateGroups).not.toHaveBeenCalled();
	});

	it("invalidates again when a second day boundary is crossed", () => {
		const dl = makeDataLayerMock();
		const watcher = new DayRolloverWatcher(new DayBoundaryService(4), dl);

		watcher.check(new Date("2026-04-22T05:00:00"));
		watcher.check(new Date("2026-04-23T05:00:00"));

		expect(dl.invalidateGroups).toHaveBeenCalledTimes(2);
	});

	it("respects custom dayStartHour", () => {
		vi.setSystemTime(new Date("2026-04-21T20:00:00"));
		const dl = makeDataLayerMock();
		const watcher = new DayRolloverWatcher(new DayBoundaryService(2), dl);

		watcher.check(new Date("2026-04-22T01:59:00"));
		expect(dl.invalidateGroups).not.toHaveBeenCalled();

		watcher.check(new Date("2026-04-22T02:00:00"));
		expect(dl.invalidateGroups).toHaveBeenCalledOnce();
	});

	it("registers focus and visibilitychange listeners on the plugin", () => {
		const dl = makeDataLayerMock();
		const watcher = new DayRolloverWatcher(new DayBoundaryService(4), dl);

		const registerDomEvent = vi.fn();
		watcher.register({ registerDomEvent } as never);

		expect(registerDomEvent).toHaveBeenCalledTimes(2);
		expect(registerDomEvent).toHaveBeenCalledWith(
			window,
			"focus",
			expect.any(Function),
		);
		expect(registerDomEvent).toHaveBeenCalledWith(
			document,
			"visibilitychange",
			expect.any(Function),
		);
	});

	it("only triggers on visibilitychange when document becomes visible", () => {
		const dl = makeDataLayerMock();
		const watcher = new DayRolloverWatcher(new DayBoundaryService(4), dl);

		let visibilityHandler: () => void = () => {};
		const registerDomEvent = vi.fn(
			(_target: unknown, event: string, handler: () => void) => {
				if (event === "visibilitychange") visibilityHandler = handler;
			},
		);
		watcher.register({ registerDomEvent } as never);

		vi.setSystemTime(new Date("2026-04-22T05:00:00"));

		vi.stubGlobal("document", { visibilityState: "hidden" });
		visibilityHandler();
		expect(dl.invalidateGroups).not.toHaveBeenCalled();

		vi.stubGlobal("document", { visibilityState: "visible" });
		visibilityHandler();
		expect(dl.invalidateGroups).toHaveBeenCalledOnce();
	});
});
