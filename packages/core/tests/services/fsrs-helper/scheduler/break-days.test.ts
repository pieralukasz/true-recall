import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	isInScheduledBreak,
	moveDueOutOfBreaks,
} from "../../../../src/metrics/fsrs-tools/scheduler/break-days";
import type { ScheduledBreak } from "../../../../src/types";

function createBreak(
	startDate: string,
	endDate: string,
	overrides: Partial<ScheduledBreak> = {},
): ScheduledBreak {
	return {
		id: `${startDate}_${endDate}`,
		startDate,
		endDate,
		redistributeBefore: true,
		redistributeAfter: true,
		...overrides,
	};
}

const TODAY = "2026-02-01";

describe("break-days", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("isInScheduledBreak", () => {
		const breaks = [createBreak("2026-02-10", "2026-02-14")];

		it.each([
			["day before the break", "2026-02-09", false],
			["first day", "2026-02-10", true],
			["middle day", "2026-02-12", true],
			["last day", "2026-02-14", true],
			["day after the break", "2026-02-15", false],
		])("%s -> %s", (_label, day, expected) => {
			expect(isInScheduledBreak(day, breaks)).toBe(expected);
		});

		it("ignores malformed or reversed breaks", () => {
			const broken = [
				createBreak("2026-2-10", "2026-02-14"),
				createBreak("2026-02-20", "2026-02-18"),
			];
			expect(isInScheduledBreak("2026-02-12", broken)).toBe(false);
			expect(isInScheduledBreak("2026-02-19", broken)).toBe(false);
		});
	});

	describe("moveDueOutOfBreaks", () => {
		const breaks = [createBreak("2026-02-10", "2026-02-14")];

		it("returns null for a due outside every break", () => {
			expect(
				moveDueOutOfBreaks("2026-02-20T09:30:00.000Z", breaks, TODAY),
			).toBeNull();
		});

		it.each([
			["near the start goes to the day before", "2026-02-11", "2026-02-09", -2],
			["near the end goes to the day after", "2026-02-14", "2026-02-15", 1],
			["a tie goes to the earlier day", "2026-02-12", "2026-02-09", -3],
		])("%s", (_label, dueDay, expectedDay, expectedShift) => {
			const shift = moveDueOutOfBreaks(
				`${dueDay}T09:30:00.000Z`,
				breaks,
				TODAY,
			);
			expect(shift?.newDue).toBe(`${expectedDay}T09:30:00.000Z`);
			expect(shift?.daysChanged).toBe(expectedShift);
		});

		it("goes after the break when the day before is not in the future", () => {
			const shift = moveDueOutOfBreaks(
				"2026-02-03T08:00:00.000Z",
				[createBreak("2026-02-02", "2026-02-05")],
				TODAY,
			);
			expect(shift?.newDue).toBe("2026-02-06T08:00:00.000Z");
		});

		it("respects redistributeBefore = false", () => {
			const shift = moveDueOutOfBreaks(
				"2026-02-10T08:00:00.000Z",
				[
					createBreak("2026-02-10", "2026-02-14", {
						redistributeBefore: false,
					}),
				],
				TODAY,
			);
			expect(shift?.newDue).toBe("2026-02-15T08:00:00.000Z");
		});

		it("treats back-to-back breaks as one, never landing in the next one", () => {
			const shift = moveDueOutOfBreaks(
				"2026-02-14T08:00:00.000Z",
				[
					createBreak("2026-02-10", "2026-02-14"),
					createBreak("2026-02-15", "2026-02-25"),
				],
				TODAY,
			);
			expect(shift?.newDue).toBe("2026-02-09T08:00:00.000Z");
		});

		it("keeps two dues in their original order", () => {
			const dues = ["2026-02-11", "2026-02-12", "2026-02-13", "2026-02-14"].map(
				(day) =>
					moveDueOutOfBreaks(`${day}T08:00:00.000Z`, breaks, TODAY)?.newDue ??
					"",
			);
			expect(dues).toStrictEqual([...dues].sort());
		});
	});
});
