import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	projectRelearning,
	WorkloadForecastCalculator,
	type WorkloadForecastCardStore,
} from "../../../../src/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import type { FSRSCardData } from "../../../../src/types";
import { formatLocalDate } from "../../../../src/utils";
import { createMockCard } from "../../../mocks/fsrs.mocks";

const NOW = new Date("2024-01-15T10:00:00Z");

function createStore(cards: FSRSCardData[]): WorkloadForecastCardStore {
	return { getCards: () => cards };
}

/** Local-day offset from the pinned clock, preserving the 10:00 time of day. */
function daysFromNow(offset: number): Date {
	const date = new Date(NOW);
	date.setDate(date.getDate() + offset);
	return date;
}

function dayKey(offset: number): string {
	return formatLocalDate(daysFromNow(offset));
}

function entryFor(
	calculator: WorkloadForecastCalculator,
	offset: number,
	days = 30,
) {
	const key = dayKey(offset);
	return calculator.getForecast(days).find((entry) => entry.date === key);
}

describe("WorkloadForecastCalculator.getForecast", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("overdue cards", () => {
		it("buckets an overdue review card into today rather than dropping it", () => {
			const card = createMockCard({
				state: State.Review,
				scheduledDays: 5,
				due: daysFromNow(-3).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			const today = entryFor(calculator, 0);

			expect(today?.breakdown.young).toBe(1);
			expect(today?.dueCount).toBe(1);
		});

		it("counts a learning card that came due earlier today", () => {
			// Learning steps are sub-day, so these cards sit slightly in the past.
			const dueEarlierToday = new Date(NOW);
			dueEarlierToday.setHours(dueEarlierToday.getHours() - 2);

			const card = createMockCard({
				state: State.Learning,
				due: dueEarlierToday.toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			expect(entryFor(calculator, 0)?.breakdown.learning).toBe(1);
		});

		it("counts relearning cards as learning", () => {
			const card = createMockCard({
				state: State.Relearning,
				due: daysFromNow(-1).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			expect(entryFor(calculator, 0)?.breakdown.learning).toBe(1);
		});
	});

	describe("future cards", () => {
		it("keeps a future card on its own day", () => {
			const card = createMockCard({
				state: State.Review,
				scheduledDays: 5,
				due: daysFromNow(3).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			expect(entryFor(calculator, 3)?.breakdown.young).toBe(1);
			expect(entryFor(calculator, 0)?.dueCount).toBe(0);
		});

		it("excludes cards due beyond the forecast window", () => {
			const card = createMockCard({
				state: State.Review,
				scheduledDays: 5,
				due: daysFromNow(40).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			const total = calculator
				.getForecast(30)
				.reduce((sum, entry) => sum + entry.dueCount, 0);
			expect(total).toBe(0);
		});
	});

	describe("maturity split", () => {
		it.each([
			["young below the threshold", 20, "young"],
			["mature at the threshold", 21, "mature"],
			["mature above the threshold", 60, "mature"],
		] as const)("classifies %s", (_label, scheduledDays, bucket) => {
			const card = createMockCard({
				state: State.Review,
				scheduledDays,
				due: daysFromNow(2).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			expect(entryFor(calculator, 2)?.breakdown[bucket]).toBe(1);
		});
	});

	describe("excluded cards", () => {
		it("skips suspended cards", () => {
			const card = createMockCard({
				state: State.Review,
				scheduledDays: 5,
				suspended: true,
				due: daysFromNow(-1).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			expect(entryFor(calculator, 0)?.dueCount).toBe(0);
		});

		it("skips cards still buried", () => {
			const card = createMockCard({
				state: State.Review,
				scheduledDays: 5,
				buriedUntil: daysFromNow(2).toISOString(),
				due: daysFromNow(-1).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			expect(entryFor(calculator, 0)?.dueCount).toBe(0);
		});

		it("includes cards whose bury has expired", () => {
			const card = createMockCard({
				state: State.Review,
				scheduledDays: 5,
				buriedUntil: daysFromNow(-2).toISOString(),
				due: daysFromNow(-1).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			expect(entryFor(calculator, 0)?.dueCount).toBe(1);
		});

		it("does not count new cards", () => {
			const card = createMockCard({
				state: State.New,
				due: daysFromNow(-1).toISOString(),
			});
			const calculator = new WorkloadForecastCalculator(createStore([card]));

			expect(entryFor(calculator, 0)?.dueCount).toBe(0);
		});
	});

	describe("source filtering", () => {
		it("honours excludeSourceUids and includeSourceUids", () => {
			const cards = [
				createMockCard({
					state: State.Review,
					scheduledDays: 5,
					sourceUid: "aaaa1111",
					due: daysFromNow(1).toISOString(),
				}),
				createMockCard({
					state: State.Review,
					scheduledDays: 5,
					sourceUid: "bbbb2222",
					due: daysFromNow(1).toISOString(),
				}),
			];
			const calculator = new WorkloadForecastCalculator(createStore(cards));
			const key = dayKey(1);

			const excluded = calculator
				.getForecast(30, new Set(["aaaa1111"]))
				.find((entry) => entry.date === key);
			expect(excluded?.dueCount).toBe(1);

			const included = calculator
				.getForecast(30, undefined, new Set(["aaaa1111"]))
				.find((entry) => entry.date === key);
			expect(included?.dueCount).toBe(1);
		});
	});

	describe("projected relearning", () => {
		function reviewCardsDueTomorrow(count: number): FSRSCardData[] {
			return Array.from({ length: count }, () =>
				createMockCard({
					state: State.Review,
					scheduledDays: 5,
					due: daysFromNow(1).toISOString(),
				}),
			);
		}

		it("stays at zero when no retention is supplied", () => {
			const calculator = new WorkloadForecastCalculator(
				createStore(reviewCardsDueTomorrow(10)),
			);

			const entry = entryFor(calculator, 1);

			expect(entry?.breakdown.projectedRelearning).toBe(0);
			expect(entry?.dueCount).toBe(10);
		});

		it("adds the projected lapses to dueCount", () => {
			const calculator = new WorkloadForecastCalculator(
				createStore(reviewCardsDueTomorrow(20)),
			);
			const key = dayKey(1);

			const entry = calculator
				.getForecast(30, undefined, undefined, 0.85)
				.find((e) => e.date === key);

			// 20 review cards * 15% lapse rate = 3
			expect(entry?.breakdown.projectedRelearning).toBe(3);
			expect(entry?.dueCount).toBe(23);
		});

		it("carries the projection into the cumulative total", () => {
			const calculator = new WorkloadForecastCalculator(
				createStore(reviewCardsDueTomorrow(20)),
			);
			const key = dayKey(1);

			const entry = calculator
				.getForecast(30, undefined, undefined, 0.85)
				.find((e) => e.date === key);

			expect(entry?.cumulative).toBe(23);
		});
	});

	describe("projectRelearning", () => {
		it.each([
			["typical lapse rate", { young: 10, mature: 10 }, 0.85, 3],
			["perfect retention yields nothing", { young: 40, mature: 0 }, 1, 0],
			["rounds to the nearest review", { young: 3, mature: 0 }, 0.85, 0],
			["empty day", { young: 0, mature: 0 }, 0.85, 0],
		] as const)("%s", (_label, breakdown, retention, expected) => {
			expect(projectRelearning(breakdown, retention)).toBe(expected);
		});

		it("ignores cards already in the relearning population", () => {
			// learning is deliberately absent from the Pick<> input: projecting
			// relapses of relearning cards would double-count them.
			expect(projectRelearning({ young: 0, mature: 0 }, 0.5)).toBe(0);
		});
	});

	describe("cumulative totals", () => {
		it("accumulates dueCount in chronological order", () => {
			const cards = [
				createMockCard({
					state: State.Review,
					scheduledDays: 5,
					due: daysFromNow(-1).toISOString(),
				}),
				createMockCard({
					state: State.Review,
					scheduledDays: 5,
					due: daysFromNow(1).toISOString(),
				}),
			];
			const calculator = new WorkloadForecastCalculator(createStore(cards));

			expect(entryFor(calculator, 0)?.cumulative).toBe(1);
			expect(entryFor(calculator, 1)?.cumulative).toBe(2);
		});
	});
});
