import { describe, expect, it, vi } from "vitest";

import type { SchedulingResult } from "@true-recall/core/metrics/fsrs-tools/scheduler/scheduler.types";

import {
	BREAK_DATES_ERROR,
	createScheduledBreak,
	isValidBreakRange,
	runScheduleBreak,
	type ScheduleBreakFlowDeps,
	shouldSaveBreak,
} from "@true-recall/obsidian/features/study/services/schedule-break-flow";

function createResult(affectedCount: number): SchedulingResult {
	return {
		affectedCount,
		beforeDistribution: [],
		afterDistribution: [],
		changes: Array.from({ length: affectedCount }, (_, i) => ({
			cardId: `card-${i}`,
			originalDue: "2026-02-12T10:00:00.000Z",
			newDue: "2026-02-09T10:00:00.000Z",
			daysChanged: -3,
		})),
	};
}

function createDeps(options: {
	cardsAffected?: number;
	applied?: number;
	confirmed?: boolean;
	previewThrows?: boolean;
}) {
	const helper = {
		previewBreak: vi.fn(() => {
			if (options.previewThrows) throw new Error("db closed");
			return { cardsAffected: options.cardsAffected ?? 0, breakDays: 5 };
		}),
		scheduleBreakPeriod: vi.fn(() => createResult(options.applied ?? 0)),
	};
	const deps = {
		helper,
		confirm: vi.fn(async () => options.confirmed ?? true),
		applyChanges: vi.fn(),
		notify: {
			info: vi.fn(),
			success: vi.fn(),
			error: vi.fn(),
			operationFailed: vi.fn(),
		},
	} satisfies ScheduleBreakFlowDeps;
	return deps;
}

describe("isValidBreakRange", () => {
	it.each([
		["a normal range", "2026-02-10", "2026-02-14", true],
		["a single day", "2026-02-10", "2026-02-10", true],
		["end before start", "2026-02-14", "2026-02-10", false],
		["a non-existent day", "2026-02-31", "2026-03-02", false],
		["a month 13", "2026-13-01", "2026-13-02", false],
		["no zero padding", "2026-2-10", "2026-02-14", false],
		["free text", "next week", "2026-02-14", false],
	])("%s -> %s", (_label, start, end, expected) => {
		expect(isValidBreakRange(start, end)).toBe(expected);
	});
});

describe("runScheduleBreak", () => {
	it("rejects invalid dates before touching any card", async () => {
		const deps = createDeps({ cardsAffected: 5 });

		const outcome = await runScheduleBreak(deps, {
			startDate: "2026-02-14",
			endDate: "2026-02-10",
		});

		expect(outcome.status).toBe("invalid");
		expect(deps.notify.error).toHaveBeenCalledWith(BREAK_DATES_ERROR);
		expect(deps.helper.previewBreak).not.toHaveBeenCalled();
	});

	it("previews every card when no scope is given, then confirms and applies", async () => {
		const deps = createDeps({ cardsAffected: 7, applied: 7 });

		const outcome = await runScheduleBreak(deps, {
			startDate: "2026-02-10",
			endDate: "2026-02-14",
		});

		expect(deps.helper.previewBreak).toHaveBeenCalledWith(
			"2026-02-10",
			"2026-02-14",
			undefined,
		);
		expect(deps.confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining("Redistribute 7 cards due during"),
			}),
		);
		expect(deps.helper.scheduleBreakPeriod).toHaveBeenCalledWith(
			expect.objectContaining({
				startDate: "2026-02-10",
				endDate: "2026-02-14",
				cardIds: undefined,
				dryRun: false,
			}),
		);
		expect(deps.applyChanges).toHaveBeenCalledWith(
			expect.objectContaining({ affectedCount: 7 }),
			"Schedule break (7 cards)",
		);
		expect(outcome).toEqual({ status: "applied", affectedCount: 7 });
	});

	it("keeps the project scope of the Dashboard flow", async () => {
		const deps = createDeps({ cardsAffected: 2, applied: 2 });

		await runScheduleBreak(deps, {
			startDate: "2026-02-10",
			endDate: "2026-02-14",
			cardIds: ["a", "b"],
			scopeLabel: 'in "Biology"',
		});

		expect(deps.helper.previewBreak).toHaveBeenCalledWith(
			"2026-02-10",
			"2026-02-14",
			["a", "b"],
		);
		expect(deps.applyChanges).toHaveBeenCalledWith(
			expect.anything(),
			'Schedule break in "Biology" (2 cards)',
		);
	});

	it("moves nothing when the user cancels", async () => {
		const deps = createDeps({ cardsAffected: 3, confirmed: false });

		const outcome = await runScheduleBreak(deps, {
			startDate: "2026-02-10",
			endDate: "2026-02-14",
		});

		expect(outcome.status).toBe("cancelled");
		expect(deps.helper.scheduleBreakPeriod).not.toHaveBeenCalled();
		expect(deps.applyChanges).not.toHaveBeenCalled();
	});

	it("reports an empty break without asking", async () => {
		const deps = createDeps({ cardsAffected: 0 });

		const outcome = await runScheduleBreak(deps, {
			startDate: "2026-02-10",
			endDate: "2026-02-14",
			emptyMessage: "Nothing due.",
		});

		expect(outcome.status).toBe("empty");
		expect(deps.confirm).not.toHaveBeenCalled();
		expect(deps.notify.info).toHaveBeenCalledWith("Nothing due.");
	});

	it("reports failures instead of throwing", async () => {
		const deps = createDeps({ previewThrows: true });

		const outcome = await runScheduleBreak(deps, {
			startDate: "2026-02-10",
			endDate: "2026-02-14",
		});

		expect(outcome.status).toBe("failed");
		expect(deps.notify.operationFailed).toHaveBeenCalled();
	});
});

describe("saved breaks", () => {
	it.each([
		["applied", true],
		["empty", false],
		["cancelled", false],
		["invalid", false],
		["failed", false],
		["unavailable", false],
	] as const)("status %s -> save %s", (status, expected) => {
		expect(shouldSaveBreak(status)).toBe(expected);
	});

	it("creates a break that redistributes on both sides", () => {
		expect(createScheduledBreak("2026-02-10", "2026-02-14", "id-1")).toEqual({
			id: "id-1",
			startDate: "2026-02-10",
			endDate: "2026-02-14",
			redistributeBefore: true,
			redistributeAfter: true,
		});
	});
});
