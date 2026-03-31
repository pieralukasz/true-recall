import { describe, expect, it } from "vitest";
import {
	buildForecastSummary,
	buildDayOfWeekStats,
} from "../../src/metrics/forecast-filter";
import type { WorkloadForecastEntry } from "../../src/metrics/fsrs-tools/statistics/workload-forecast.calculator";

function makeEntry(
	date: string,
	dueCount: number,
	review = dueCount,
	learning = 0,
): WorkloadForecastEntry {
	return { date, dueCount, breakdown: { review, learning } };
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
		// peak == avg, so peak > avg*1.5 is false; 0 > 3*0.2 is false
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

		// avg = 70/5 = 14
		expect(result.avgDaily).toBe(14);
		expect(result.peakDay).toEqual({ date: "2026-04-03", count: 50 });
		expect(result.minDay).toEqual({ date: "2026-04-01", count: 5 });
		// 50 > 14*1.5 = 21 → needsBalancing
		expect(result.needsBalancing).toBe(true);
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
