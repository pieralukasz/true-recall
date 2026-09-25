import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_FSRS_PRESET, DEFAULT_SETTINGS } from "../../../src/constants";
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

		expect(summary.peakDay.count).toBe(13);
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

	describe("rating button order", () => {
		// Good at 10 days and Easy at 12 days have overlapping fuzz ranges, so
		// balancing each button on its own used to be able to schedule Easy
		// before Good. "card-2" is a card id where that inversion happened.
		const CARD_ID = "card-2";
		const RAW_PREVIEW = {
			again: { due: new Date("2026-02-01T10:05:00.000Z"), interval: "5m" },
			hard: { due: new Date("2026-02-01T10:20:00.000Z"), interval: "20m" },
			good: { due: new Date("2026-02-11T10:00:00.000Z"), interval: "10d" },
			easy: { due: new Date("2026-02-13T10:00:00.000Z"), interval: "12d" },
		};

		function createOrderHelper() {
			const store = createStore({ allCards: [], balanceCards: [] });
			return new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				loadBalanceEnabled: true,
				loadBalanceMaxShiftDays: 14,
			});
		}

		it("keeps the previewed buttons in non-decreasing due order", () => {
			const preview = createOrderHelper().balanceSchedulingPreview(
				CARD_ID,
				RAW_PREVIEW,
			);

			const dues = [
				preview.again.due.getTime(),
				preview.hard.due.getTime(),
				preview.good.due.getTime(),
				preview.easy.due.getTime(),
			];
			expect(dues).toStrictEqual([...dues].sort((a, b) => a - b));
			// Without the ordering chain Easy landed on 2026-02-11, before Good.
			expect(preview.easy.due.getTime()).toBeGreaterThanOrEqual(
				preview.good.due.getTime(),
			);
		});

		it("stores the due date the answered rating button showed", () => {
			const helper = createOrderHelper();
			const preview = helper.balanceSchedulingPreview(CARD_ID, RAW_PREVIEW);

			const scheduled = helper.balanceScheduledReview(
				CARD_ID,
				{
					id: CARD_ID,
					due: RAW_PREVIEW.easy.due.toISOString(),
					state: State.Review,
					scheduledDays: 12,
					stability: 20,
					difficulty: 5,
					reps: 3,
					lapses: 0,
					lastReview: "2026-02-01T10:00:00.000Z",
					learningStep: 0,
				},
				{ rating: "easy", rawPreview: RAW_PREVIEW },
			);

			expect(scheduled.due).toBe(preview.easy.due.toISOString());
		});
	});

	describe("getTrueRetentionSummary", () => {
		it("reports the default preset's target, not the legacy flat field", () => {
			const store = createStore({ allCards: [], balanceCards: [] });
			const helper = new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				fsrsRequestRetention: 0.9,
				defaultPresetId: "default",
				fsrsPresets: [
					{
						...DEFAULT_FSRS_PRESET,
						id: "default",
						name: "Default",
						requestRetention: 0.88,
					},
				],
			});

			expect(helper.getTrueRetentionSummary().target).toBe(0.88);
		});

		it("reports a single scoped preset's own target", () => {
			const store = createStore({ allCards: [], balanceCards: [] });
			const helper = new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				fsrsRequestRetention: 0.9,
				defaultPresetId: "default",
				fsrsPresets: [
					{
						...DEFAULT_FSRS_PRESET,
						id: "default",
						name: "Default",
						requestRetention: 0.88,
					},
					{
						...DEFAULT_FSRS_PRESET,
						id: "language",
						name: "Language",
						requestRetention: 0.8,
					},
				],
			});

			expect(helper.getTrueRetentionSummary(30, ["Language"]).target).toBe(0.8);
		});

		it("falls back to the flat field for pre-preset settings files", () => {
			const store = createStore({ allCards: [], balanceCards: [] });
			const helper = new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				fsrsRequestRetention: 0.87,
				fsrsPresets: [],
			});

			expect(helper.getTrueRetentionSummary().target).toBe(0.87);
		});
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

describe("FSRSHelperService scheduled breaks", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const BREAK = {
		id: "vacation",
		startDate: "2026-02-10",
		endDate: "2026-02-14",
		redistributeBefore: true,
		redistributeAfter: true,
	};

	function reviewFsrs(due: string, scheduledDays: number) {
		return {
			id: "current",
			due,
			state: State.Review,
			scheduledDays,
			stability: 10,
			difficulty: 5,
			reps: 3,
			lapses: 0,
			lastReview: "2026-02-01T10:00:00.000Z",
			learningStep: 0,
		};
	}

	function createBreakHelper(loadBalanceEnabled: boolean) {
		const store = createStore({ allCards: [], balanceCards: [] });
		return new FSRSHelperService(store as never, {
			...DEFAULT_SETTINGS,
			loadBalanceEnabled,
			loadBalanceMaxShiftDays: 14,
			scheduledBreaks: [BREAK],
		});
	}

	it.each([
		["with load balancing off", false],
		["with load balancing on", true],
	])("moves an answered review out of a saved break %s", (_label, enabled) => {
		const scheduled = createBreakHelper(enabled).balanceScheduledReview(
			"current",
			reviewFsrs("2026-02-12T10:00:00.000Z", 11),
		);

		const day = scheduled.due.slice(0, 10);
		expect(day < "2026-02-10" || day > "2026-02-14").toBe(true);
	});

	it("keeps preview and stored due identical and marks the shift", () => {
		const helper = createBreakHelper(false);
		const preview = helper.balanceSchedulingPreview("current", {
			again: { due: new Date("2026-02-01T10:05:00.000Z"), interval: "5m" },
			hard: { due: new Date("2026-02-08T10:00:00.000Z"), interval: "7d" },
			good: { due: new Date("2026-02-12T10:00:00.000Z"), interval: "11d" },
			easy: { due: new Date("2026-02-14T10:00:00.000Z"), interval: "13d" },
		});
		const scheduled = helper.balanceScheduledReview(
			"current",
			reviewFsrs("2026-02-12T10:00:00.000Z", 11),
		);

		expect(preview.good.due.toISOString()).toBe(scheduled.due);
		expect(preview.good.originalDue?.toISOString()).toBe(
			"2026-02-12T10:00:00.000Z",
		);
		expect(preview.good.loadBalanceNote).toBe(
			"Moved out of a scheduled break.",
		);
		expect(preview.hard.due.toISOString()).toBe("2026-02-08T10:00:00.000Z");
		expect(preview.easy.due.toISOString()).toBe("2026-02-15T10:00:00.000Z");
		expect(preview.again.due.toISOString()).toBe("2026-02-01T10:05:00.000Z");
	});

	it("leaves same-day learning steps alone", () => {
		const fsrs = {
			...reviewFsrs("2026-02-01T10:10:00.000Z", 0),
			state: State.Relearning,
		};
		expect(
			createBreakHelper(false).balanceScheduledReview("current", fsrs),
		).toBe(fsrs);
	});

	it("never lets the load balancer pick a day inside a saved break", () => {
		// Days before the break are crowded, so without the exclusion the
		// balancer would prefer the empty break days
		const crowded = ["2026-02-07", "2026-02-08", "2026-02-09"].flatMap((day) =>
			createCards(`busy-${day}`, 30, State.Review, {
				due: `${day}T10:00:00.000Z`,
			}),
		);
		for (const cardId of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
			const store = createStore({ allCards: crowded, balanceCards: crowded });
			const helper = new FSRSHelperService(store as never, {
				...DEFAULT_SETTINGS,
				loadBalanceEnabled: true,
				loadBalanceMaxShiftDays: 14,
				scheduledBreaks: [BREAK],
			});
			const scheduled = helper.balanceScheduledReview(
				cardId,
				reviewFsrs("2026-02-08T10:00:00.000Z", 7),
			);
			const day = scheduled.due.slice(0, 10);
			expect(
				day < "2026-02-10" || day > "2026-02-14",
				`${cardId}: ${day}`,
			).toBe(true);
		}
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
		getReviewsForRetention: vi.fn(() => []),
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
