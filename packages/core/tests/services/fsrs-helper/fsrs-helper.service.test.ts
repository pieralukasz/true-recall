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
			loadBalanceTargetMode: "manual",
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
			loadBalanceTargetMode: "manual",
			loadBalanceTarget: 10,
			loadBalanceMaxDeviation: 20,
		});

		const summary = helper.getWorkloadForecastSummary(30);

		// 13 scheduled review cards plus one projected relapse
		// (default retention 0.9 → round(13 * 0.1) = 1).
		expect(summary.peakDay.count).toBe(14);
		expect(summary.needsBalancing).toBe(true);
		expect(store.updateCardDue).not.toHaveBeenCalled();
	});

	it("uses the same balanced due date for preview and scheduled review", () => {
		const balanceCards = createCardsOnDate("existing", 12, State.Review, {
			due: "2026-02-05T12:00:00.000Z",
		});
		const store = createStore({
			allCards: balanceCards,
			balanceCards,
		});
		const helper = new FSRSHelperService(store as never, {
			...DEFAULT_SETTINGS,
			loadBalanceEnabled: true,
			loadBalanceTarget: 10,
			loadBalanceMaxDeviation: 20,
			loadBalanceMaxShiftDays: 3,
		});
		const fsrs = {
			id: "current",
			due: "2026-02-05T12:00:00.000Z",
			state: State.Review,
			scheduledDays: 4,
			stability: 10,
			difficulty: 5,
			reps: 3,
			lapses: 0,
			lastReview: "2026-02-01T10:00:00.000Z",
			learningStep: 0,
		};

		const scheduled = helper.balanceScheduledReview("current", fsrs);
		const preview = helper.balanceSchedulingPreview("current", {
			again: { due: new Date("2026-02-01T10:05:00.000Z"), interval: "5m" },
			hard: { due: new Date("2026-02-05T12:00:00.000Z"), interval: "4d" },
			good: { due: new Date("2026-02-05T12:00:00.000Z"), interval: "4d" },
			easy: { due: new Date("2026-02-08T12:00:00.000Z"), interval: "7d" },
		});

		expect(scheduled.due).toBe(preview.good.due.toISOString());
		expect(preview.good.originalDue?.toISOString()).toBe(
			"2026-02-05T12:00:00.000Z",
		);
		expect(preview.good.daysChanged).not.toBe(0);
	});

	describe("getWorkloadDecision", () => {
		it("suggests the median pace in auto mode when history is rich", () => {
			const store = createStore({
				allCards: [],
				balanceCards: [],
				dailyReviews: Array.from({ length: 10 }, () => 120),
			});
			const helper = new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				loadBalanceTargetMode: "auto",
			});

			const decision = helper.getWorkloadDecision();

			expect(decision.suggestedTarget).toBe(120);
			expect(decision.usedPaceFallback).toBe(false);
			expect(helper.getEffectiveLoadBalanceTarget()).toBe(120);
		});

		it("falls back to the forecast average when pace history is thin", () => {
			const cards = createCards("review", 62, State.Review, {
				due: "2026-02-10T12:00:00.000Z",
			});
			const store = createStore({
				allCards: cards,
				balanceCards: cards,
				dailyReviews: [100, 100],
			});
			const helper = new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				loadBalanceTargetMode: "auto",
			});

			const decision = helper.getWorkloadDecision();

			expect(decision.usedPaceFallback).toBe(true);
			expect(decision.suggestedTarget).toBe(2);
		});

		it("keeps the manual target as the effective target", () => {
			const store = createStore({
				allCards: [],
				balanceCards: [],
				dailyReviews: Array.from({ length: 10 }, () => 120),
			});
			const helper = new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				loadBalanceTargetMode: "manual",
				loadBalanceTarget: 80,
			});

			const decision = helper.getWorkloadDecision();

			expect(decision.effectiveTarget).toBe(80);
			expect(decision.suggestedTarget).toBe(120);
		});

		it("projects backlog catch-up at the effective target", () => {
			const overdue = createCards("overdue", 100, State.Review, {
				due: "2026-01-15T12:00:00.000Z",
			});
			const store = createStore({
				allCards: overdue,
				balanceCards: overdue,
				dailyReviews: Array.from({ length: 14 }, () => 50),
			});
			const helper = new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				loadBalanceTargetMode: "auto",
			});

			const decision = helper.getWorkloadDecision();

			// steady state bottoms out at 1 (computeAutoTarget's Math.max(1, ...))
			expect(decision.backlogSize).toBe(100);
			expect(decision.targetFloor).toBe(2);
			expect(decision.suggestedTarget).toBe(50);
			expect(decision.catchUp.days).toBe(Math.ceil(100 / 49));
		});
	});
});

interface TestCard {
	id: string;
	due: string;
	state: State;
	suspended: boolean;
	buriedUntil: string | undefined;
	scheduledDays: number;
}

function createCards(
	idPrefix: string,
	count: number,
	state: State,
	overrides: Partial<TestCard> = {},
): TestCard[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `${idPrefix}-${index}`,
		due: "2026-02-01T12:00:00.000Z",
		state,
		suspended: false,
		buriedUntil: undefined,
		scheduledDays: 7,
		...overrides,
	}));
}

function createCardsOnDate(
	idPrefix: string,
	count: number,
	state: State,
	overrides: Partial<TestCard>,
) {
	return createCards(idPrefix, count, state, overrides);
}

function createStore({
	allCards,
	balanceCards,
	dailyReviews = [],
}: {
	allCards: ReturnType<typeof createCards>;
	balanceCards: ReturnType<typeof createCards>;
	dailyReviews?: number[];
}) {
	return {
		getCards: vi.fn(() => allCards),
		getDueCardsByDateRange: vi.fn(() => balanceCards),
		getDueCountsByDateRange: vi.fn(
			(startDate: string, endDate: string, excludeCardId?: string) => {
				const counts = new Map<string, number>();
				for (const card of balanceCards) {
					if (card.state === State.New || card.id === excludeCardId) continue;
					const day = card.due.split("T")[0] ?? "";
					if (day < startDate || day > endDate) continue;
					counts.set(day, (counts.get(day) ?? 0) + 1);
				}
				return Array.from(counts.entries())
					.map(([day, count]) => ({ day, count }))
					.sort((a, b) => a.day.localeCompare(b.day));
			},
		),
		updateCardDue: vi.fn(),
		stats: {
			getDailyStats: vi.fn(() => null),
			getDailyStatsFromReviewLog: vi.fn(() =>
				dailyReviews.map((reviewsCompleted, index) => ({
					date: `2025-12-${String(index + 1).padStart(2, "0")}`,
					reviewsCompleted,
				})),
			),
		},
	};
}
