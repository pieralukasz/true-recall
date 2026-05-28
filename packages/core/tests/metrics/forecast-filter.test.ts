import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import {
	buildDayOfWeekStats,
	buildFilteredForecast,
	buildForecastSummary,
	forecastRangeToDays,
} from "../../src/metrics/forecast-filter";
import type { WorkloadForecastEntry } from "../../src/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import { createMockCard } from "../mocks/fsrs.mocks";

function makeEntry(
	date: string,
	dueCount: number,
	young = dueCount,
	mature = 0,
	learning = 0,
): WorkloadForecastEntry {
	return {
		date,
		dueCount,
		cumulative: 0,
		breakdown: { young, mature, learning },
	};
}

/** ISO string for a date `days` from now. */
function dueIn(days: number): string {
	return new Date(Date.now() + days * 86_400_000).toISOString();
}

describe("buildForecastSummary", () => {
	it("returns zeros and needsBalancing false for empty forecast", () => {
		const result = buildForecastSummary([], 10);

		expect(result.avgDaily).toBe(0);
		expect(result.peakDay).toEqual({ date: "", count: 0 });
		expect(result.minDay).toEqual({ date: "", count: 0 });
		expect(result.daysAboveTarget).toBe(0);
		expect(result.needsBalancing).toBe(false);
	});

	it("computes correct avg for uniform load and needsBalancing false", () => {
		const forecast = [
			makeEntry("2026-04-01", 10),
			makeEntry("2026-04-02", 10),
			makeEntry("2026-04-03", 10),
		];

		const result = buildForecastSummary(forecast, 10);

		expect(result.avgDaily).toBe(10);
		// No day exceeds target (> not >=), so daysAboveTarget=0
		expect(result.daysAboveTarget).toBe(0);
		// peak is not above the default 20% deviation threshold
		expect(result.needsBalancing).toBe(false);
	});

	it("detects spike and sets needsBalancing true", () => {
		const forecast = [
			makeEntry("2026-04-01", 5),
			makeEntry("2026-04-02", 5),
			makeEntry("2026-04-03", 50),
			makeEntry("2026-04-04", 5),
			makeEntry("2026-04-05", 5),
		];

		const result = buildForecastSummary(forecast, 10);

		expect(result.avgDaily).toBe(14);
		expect(result.peakDay).toEqual({ date: "2026-04-03", count: 50 });
		expect(result.minDay).toEqual({ date: "2026-04-01", count: 5 });
		// 50 > target 10 + 20% deviation
		expect(result.needsBalancing).toBe(true);
	});

	it("does not recommend balancing when peak is within allowed deviation", () => {
		const forecast = [
			makeEntry("2026-04-01", 12),
			makeEntry("2026-04-02", 0),
			makeEntry("2026-04-03", 0),
			makeEntry("2026-04-04", 0),
			makeEntry("2026-04-05", 0),
		];

		const result = buildForecastSummary(forecast, 10, 20);

		expect(result.avgDaily).toBe(2);
		expect(result.daysAboveTarget).toBe(1);
		expect(result.needsBalancing).toBe(false);
	});

	it("counts all days above target when all exceed it", () => {
		const forecast = [
			makeEntry("2026-04-01", 20),
			makeEntry("2026-04-02", 25),
			makeEntry("2026-04-03", 30),
		];

		const result = buildForecastSummary(forecast, 10);

		// All 3 entries have dueCount > 10
		expect(result.daysAboveTarget).toBe(3);
	});
});

describe("buildFilteredForecast", () => {
	it("splits review cards into young/mature by interval and tracks learning", () => {
		const cards = [
			createMockCard({ due: dueIn(1), state: State.Review, scheduledDays: 5 }),
			createMockCard({ due: dueIn(1), state: State.Review, scheduledDays: 30 }),
			createMockCard({
				due: dueIn(2),
				state: State.Learning,
				scheduledDays: 0,
			}),
		];

		const forecast = buildFilteredForecast(cards, 7);

		const young = forecast.reduce((n, e) => n + e.breakdown.young, 0);
		const mature = forecast.reduce((n, e) => n + e.breakdown.mature, 0);
		const learning = forecast.reduce((n, e) => n + e.breakdown.learning, 0);

		expect(young).toBe(1);
		expect(mature).toBe(1);
		expect(learning).toBe(1);
	});

	it("uses 21 days as the young/mature boundary (inclusive of mature)", () => {
		const cards = [
			createMockCard({ due: dueIn(1), state: State.Review, scheduledDays: 20 }),
			createMockCard({ due: dueIn(1), state: State.Review, scheduledDays: 21 }),
		];

		const forecast = buildFilteredForecast(cards, 7);

		expect(forecast.reduce((n, e) => n + e.breakdown.young, 0)).toBe(1);
		expect(forecast.reduce((n, e) => n + e.breakdown.mature, 0)).toBe(1);
	});

	it("produces a non-decreasing cumulative ending at the total due count", () => {
		const cards = [
			createMockCard({ due: dueIn(1), state: State.Review, scheduledDays: 5 }),
			createMockCard({ due: dueIn(3), state: State.Review, scheduledDays: 30 }),
			createMockCard({
				due: dueIn(5),
				state: State.Learning,
				scheduledDays: 0,
			}),
		];

		const forecast = buildFilteredForecast(cards, 7);

		let prev = 0;
		for (const entry of forecast) {
			expect(entry.cumulative).toBeGreaterThanOrEqual(prev);
			prev = entry.cumulative;
		}
		const total = forecast.reduce((n, e) => n + e.dueCount, 0);
		expect(forecast.at(-1)?.cumulative).toBe(total);
		expect(total).toBe(3);
	});

	it("excludes suspended cards", () => {
		const cards = [
			createMockCard({
				due: dueIn(1),
				state: State.Review,
				scheduledDays: 5,
				suspended: true,
			}),
		];

		const forecast = buildFilteredForecast(cards, 7);

		expect(forecast.reduce((n, e) => n + e.dueCount, 0)).toBe(0);
	});
});

describe("forecastRangeToDays", () => {
	it("maps fixed ranges to day counts regardless of cards", () => {
		expect(forecastRangeToDays("1m", [])).toBe(30);
		expect(forecastRangeToDays("3m", [])).toBe(90);
		expect(forecastRangeToDays("1y", [])).toBe(365);
	});

	it("defaults 'all' to 30 days when no cards are scheduled", () => {
		expect(forecastRangeToDays("all", [])).toBe(30);
	});

	it("'all' spans to the furthest due card", () => {
		const cards = [
			createMockCard({ due: dueIn(10), state: State.Review, scheduledDays: 5 }),
			createMockCard({
				due: dueIn(100),
				state: State.Review,
				scheduledDays: 5,
			}),
		];

		const days = forecastRangeToDays("all", cards);

		expect(days).toBeGreaterThanOrEqual(100);
		expect(days).toBeLessThanOrEqual(101);
	});

	it("'all' ignores suspended cards when finding the horizon", () => {
		const cards = [
			createMockCard({
				due: dueIn(500),
				state: State.Review,
				scheduledDays: 5,
				suspended: true,
			}),
		];

		expect(forecastRangeToDays("all", cards)).toBe(30);
	});
});

describe("buildDayOfWeekStats", () => {
	it("returns exactly 7 entries sorted by day number", () => {
		const result = buildDayOfWeekStats([]);

		expect(result).toHaveLength(7);
		expect(result[0]?.day).toBe(0);
		expect(result[0]?.dayName).toBe("Sunday");
		expect(result[6]?.day).toBe(6);
		expect(result[6]?.dayName).toBe("Saturday");
	});

	it("returns all zeros for empty forecast", () => {
		const result = buildDayOfWeekStats([]);

		for (const entry of result) {
			expect(entry.avgCount).toBe(0);
		}
	});

	it("averages correctly for given day-of-week", () => {
		// 2026-04-06 is a Monday (day 1), 2026-04-13 is also Monday
		const forecast = [
			makeEntry("2026-04-06", 10),
			makeEntry("2026-04-13", 20),
			// 2026-04-07 is Tuesday (day 2)
			makeEntry("2026-04-07", 6),
		];

		const result = buildDayOfWeekStats(forecast);
		const monday = result.find((e) => e.day === 1);
		const tuesday = result.find((e) => e.day === 2);

		// Monday avg: (10+20)/2 = 15
		expect(monday?.avgCount).toBe(15);
		// Tuesday avg: 6/1 = 6
		expect(tuesday?.avgCount).toBe(6);
		// Sunday has no entries
		expect(result.find((e) => e.day === 0)?.avgCount).toBe(0);
	});
});
