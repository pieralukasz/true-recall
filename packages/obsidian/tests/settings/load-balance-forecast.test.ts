import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkloadDecision } from "@true-recall/core/metrics/fsrs-tools";

import { buildLoadBalanceForecast } from "../../src/settings/tabs/fsrs/load-balance-forecast";

const DECISION: WorkloadDecision = {
	steadyStatePerDay: 10,
	backlogSize: 0,
	targetFloor: 10,
	medianPace: 10,
	p75Pace: 12,
	activeDays: 14,
	suggestedTarget: 10,
	usedPaceFallback: false,
	catchUp: { days: 0, date: "2026-02-01" },
	effectiveTarget: 10,
};

describe("buildLoadBalanceForecast", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("builds every visualization from one card snapshot", () => {
		const cards = [createCard("review", State.Review)];
		const getCards = vi.fn(() => cards);
		const getWorkloadDecision = vi.fn(() => DECISION);
		const source = {
			cardStore: { getCards },
			fsrsHelper: { getWorkloadDecision },
		};

		const result = buildLoadBalanceForecast(source as never, "3m", 20);

		expect(result?.forecast).toHaveLength(91);
		expect(result?.dayOfWeek).toHaveLength(7);
		expect(getCards).toHaveBeenCalledTimes(1);
		expect(getWorkloadDecision).toHaveBeenCalledTimes(1);
	});

	it("does not suggest balancing for a learning-only spike", () => {
		const cards = Array.from({ length: 50 }, (_, index) =>
			createCard(`learning-${index}`, State.Learning),
		);

		const result = buildLoadBalanceForecast(
			{
				cardStore: { getCards: () => cards },
				fsrsHelper: { getWorkloadDecision: () => DECISION },
			} as never,
			"1m",
			20,
		);

		expect(result?.summary.peakDay.count).toBe(50);
		expect(result?.summary.needsBalancing).toBe(false);
	});

	it("suggests balancing for a movable review spike", () => {
		const cards = Array.from({ length: 13 }, (_, index) =>
			createCard(`review-${index}`, State.Review),
		);

		const result = buildLoadBalanceForecast(
			{
				cardStore: { getCards: () => cards },
				fsrsHelper: { getWorkloadDecision: () => DECISION },
			} as never,
			"1m",
			20,
		);

		expect(result?.summary.needsBalancing).toBe(true);
	});
});

function createCard(id: string, state: State) {
	return {
		id,
		due: "2026-02-10T12:00:00.000Z",
		state,
		suspended: false,
		buriedUntil: undefined,
		scheduledDays: 7,
	};
}
