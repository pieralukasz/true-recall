import { describe, expect, it } from "vitest";

import { computeTodayProgressSegments } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/today-progress-segments";

describe("computeTodayProgressSegments", () => {
	it("shows completed work against completed plus currently actionable work", () => {
		const result = computeTodayProgressSegments(
			{
				studied: 225,
				minutes: 58,
				newCards: 0,
				newCardsCap: 20,
				reviewCards: 225,
				reviewsCap: 10_000,
			},
			18,
		);

		expect(result.newPct + result.reviewPct + result.learningPct).toBeCloseTo(
			225 / 243,
		);
		expect(result.reviewPct).toBeCloseTo(225 / 243);
		expect(result.learningPct).toBe(0);
	});

	it("uses the studied remainder as the learning segment", () => {
		const result = computeTodayProgressSegments(
			{
				studied: 25,
				minutes: 8,
				newCards: 5,
				newCardsCap: 20,
				reviewCards: 12,
				reviewsCap: 200,
			},
			25,
		);

		expect(result.newPct).toBeCloseTo(5 / 50);
		expect(result.reviewPct).toBeCloseTo(12 / 50);
		expect(result.learningPct).toBeCloseTo(8 / 50);
	});

	it("fills the bar when all current work is complete", () => {
		const result = computeTodayProgressSegments(
			{
				studied: 20,
				minutes: 5,
				newCards: 5,
				newCardsCap: 20,
				reviewCards: 15,
				reviewsCap: 200,
			},
			0,
		);

		expect(result.newPct + result.reviewPct + result.learningPct).toBe(1);
	});

	it("leaves the bar empty before studying", () => {
		const result = computeTodayProgressSegments(
			{
				studied: 0,
				minutes: 0,
				newCards: 0,
				newCardsCap: 20,
				reviewCards: 0,
				reviewsCap: 200,
			},
			18,
		);

		expect(result).toEqual({ newPct: 0, reviewPct: 0, learningPct: 0 });
	});
});
