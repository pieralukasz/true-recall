import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	computePaceStats,
	computeSuggestedTarget,
	computeTargetFloor,
	MIN_ACTIVE_DAYS,
	projectCatchUp,
} from "../../../../src/metrics/fsrs-tools/scheduler/target-suggestion";

describe("computePaceStats", () => {
	it("ignores zero-review days and reports active day count", () => {
		const stats = computePaceStats([0, 100, 0, 200, 300, 0]);

		expect(stats.activeDays).toBe(3);
		expect(stats.medianPace).toBe(200);
	});

	it("interpolates percentiles between samples", () => {
		const stats = computePaceStats([100, 200, 300, 400]);

		expect(stats.medianPace).toBe(250);
		expect(stats.p75Pace).toBe(325);
	});

	it("returns zeros for an empty history", () => {
		expect(computePaceStats([])).toEqual({
			medianPace: 0,
			p75Pace: 0,
			activeDays: 0,
		});
	});
});

describe("computeTargetFloor", () => {
	it.each([
		["no backlog keeps the steady state", 50, 0, 50],
		["a backlog raises the floor by one", 50, 10, 51],
	])("%s", (_name, steadyState, backlog, expected) => {
		expect(computeTargetFloor(steadyState, backlog)).toBe(expected);
	});
});

describe("computeSuggestedTarget", () => {
	const pace = (medianPace: number, activeDays: number) => ({
		medianPace,
		p75Pace: medianPace,
		activeDays,
	});

	it("suggests the median pace when it clears the floor", () => {
		expect(computeSuggestedTarget(pace(150, 30), 50, 100)).toBe(150);
	});

	it("raises to the floor when the median pace is under water", () => {
		expect(computeSuggestedTarget(pace(40, 30), 50, 100)).toBe(51);
	});

	it("returns null when history is thinner than MIN_ACTIVE_DAYS", () => {
		expect(
			computeSuggestedTarget(pace(150, MIN_ACTIVE_DAYS - 1), 50, 100),
		).toBe(null);
	});
});

describe("projectCatchUp", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("divides the backlog by the surplus and rounds up", () => {
		const projection = projectCatchUp(151, 47, 1000, new Date());

		expect(projection.days).toBe(10);
		expect(projection.date).toBe("2026-02-11");
	});

	it("never catches up when the target is at or below steady state", () => {
		expect(projectCatchUp(47, 47, 1000, new Date())).toEqual({
			days: null,
			date: null,
		});
	});

	it("is already caught up without a backlog", () => {
		expect(projectCatchUp(100, 47, 0, new Date())).toEqual({
			days: 0,
			date: "2026-02-01",
		});
	});
});
