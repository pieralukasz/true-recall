import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../../src/constants";
import { FSRSHelperService } from "../../../src/metrics/fsrs-tools/fsrs-helper.service";

describe("FSRSHelperService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("does not recommend load balancing for learning-only forecast spikes", () => {
		const cards = createCards("learning", 50, State.Learning);
		const store = createStore({
			allCards: cards,
			balanceCards: [],
		});
		const helper = new FSRSHelperService(store as never, {
			...DEFAULT_SETTINGS,
			loadBalanceTarget: 10,
			loadBalanceMaxDeviation: 20,
		});

		const summary = helper.getWorkloadForecastSummary(30);

		expect(summary.peakDay.count).toBe(50);
		expect(summary.needsBalancing).toBe(false);
		expect(store.getDueCardsByDateRange).toHaveBeenCalled();
	});

	it("recommends load balancing when a dry run can move review cards", () => {
		const cards = createCards("review", 13, State.Review);
		const store = createStore({
			allCards: cards,
			balanceCards: cards,
		});
		const helper = new FSRSHelperService(store as never, {
			...DEFAULT_SETTINGS,
			loadBalanceTarget: 10,
			loadBalanceMaxDeviation: 20,
		});

		const summary = helper.getWorkloadForecastSummary(30);

		expect(summary.peakDay.count).toBe(13);
		expect(summary.needsBalancing).toBe(true);
		expect(store.updateCardDue).not.toHaveBeenCalled();
	});
});

function createCards(idPrefix: string, count: number, state: State) {
	return Array.from({ length: count }, (_, index) => ({
		id: `${idPrefix}-${index}`,
		due: "2026-02-01T12:00:00.000Z",
		state,
		suspended: false,
		buriedUntil: undefined,
		scheduledDays: 7,
	}));
}

function createStore({
	allCards,
	balanceCards,
}: {
	allCards: ReturnType<typeof createCards>;
	balanceCards: ReturnType<typeof createCards>;
}) {
	return {
		getCards: vi.fn(() => allCards),
		getDueCardsByDateRange: vi.fn(() => balanceCards),
		updateCardDue: vi.fn(),
	};
}
