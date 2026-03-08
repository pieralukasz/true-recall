/**
 * Forget Feature Integration Tests
 *
 * Cross-layer tests verifying the full forget flow:
 * Card state transitions → reviewedToday tracking → countByState (panel badges) + ReviewService.buildQueue (queue filtering)
 *
 * These tests simulate the exact sequence of operations that happen during forget:
 * 1. Card FSRS state reset to New (bulkForget)
 * 2. Card removed from daily_reviewed_cards (removeReviewedCard)
 * 3. Queue rebuilt / badge counts recalculated
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { State } from "ts-fsrs";
import {
	ReviewService,
	type QueueBuildOptions,
} from "../../../../src/features/study/services/review.service";
import { FSRSService } from "../../../../src/features/core/services/fsrs.service";
import { countByState } from "../../../../src/features/library/ui/panel/utils/card-status.utils";
import type { FSRSFlashcardItem } from "../../../../src/shared/types";
import {
	createMockFlashcard,
	createDefaultFSRSSettings,
} from "../../mocks/fsrs.mocks";

/** Simulate what bulkForget does to a card's FSRS data */
function forgetCard(card: FSRSFlashcardItem): FSRSFlashcardItem {
	return {
		...card,
		fsrs: {
			...card.fsrs,
			state: State.New,
			reps: 0,
			lapses: 0,
			stability: 0,
			difficulty: 0,
			scheduledDays: 0,
			learningStep: 0,
			lastReview: null,
			suspended: false,
			buriedUntil: undefined,
		},
	};
}

function createDueReviewCard(
	id: string,
	dueOffsetMinutes = -60,
): FSRSFlashcardItem {
	const due = new Date(Date.now() + dueOffsetMinutes * 60 * 1000);
	return createMockFlashcard({
		id,
		fsrs: {
			state: State.Review,
			due: due.toISOString(),
			stability: 10,
			difficulty: 5,
			reps: 3,
			lastReview: new Date(
				Date.now() - 7 * 24 * 60 * 60 * 1000,
			).toISOString(),
		},
	});
}

describe("Forget Integration", () => {
	let reviewService: ReviewService;
	let fsrsService: FSRSService;
	const defaultOptions: QueueBuildOptions = {
		newCardsLimit: 20,
		reviewsLimit: 200,
		reviewedToday: new Set(),
		newCardsStudiedToday: 0,
		dayStartHour: 4,
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		reviewService = new ReviewService();
		fsrsService = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ── Group 1: Forget → reviewedToday → queue filtering ──────

	describe("forget removes from reviewedToday and queue includes card", () => {
		it("card reviewed today then forgotten appears in new queue", () => {
			const card = createDueReviewCard("card-1");
			const reviewedToday = new Set(["card-1"]);

			// Before forget: card excluded from queue
			let queue = reviewService.buildQueue([card], fsrsService, {
				...defaultOptions,
				reviewedToday,
			});
			expect(queue).toHaveLength(0);

			// Forget: reset card state + remove from reviewedToday
			const forgotten = forgetCard(card);
			reviewedToday.delete("card-1");

			// After forget: card is New and included in queue
			queue = reviewService.buildQueue([forgotten], fsrsService, {
				...defaultOptions,
				reviewedToday,
			});
			expect(queue).toHaveLength(1);
			expect(queue[0]!.id).toBe("card-1");
			expect(queue[0]!.fsrs.state).toBe(State.New);
		});

		it("card reviewed today but NOT forgotten stays excluded from queue", () => {
			const card = createDueReviewCard("card-1");
			const reviewedToday = new Set(["card-1"]);

			const queue = reviewService.buildQueue([card], fsrsService, {
				...defaultOptions,
				reviewedToday,
			});
			expect(queue).toHaveLength(0);
		});

		it("multiple cards: forget some, keep others → correct filtering", () => {
			const card1 = createDueReviewCard("card-1");
			const card2 = createDueReviewCard("card-2");
			const card3 = createDueReviewCard("card-3");
			const reviewedToday = new Set(["card-1", "card-2", "card-3"]);

			// Forget card-1 and card-2 only
			const forgotten1 = forgetCard(card1);
			const forgotten2 = forgetCard(card2);
			reviewedToday.delete("card-1");
			reviewedToday.delete("card-2");

			const queue = reviewService.buildQueue(
				[forgotten1, forgotten2, card3],
				fsrsService,
				{ ...defaultOptions, reviewedToday },
			);

			const queueIds = queue.map((c) => c.id);
			expect(queueIds).toContain("card-1");
			expect(queueIds).toContain("card-2");
			expect(queueIds).not.toContain("card-3");
		});

		it("forgotten card without reviewedToday removal stays excluded (bug scenario)", () => {
			const card = createDueReviewCard("card-1");
			const reviewedToday = new Set(["card-1"]);

			// Forget card but DON'T remove from reviewedToday (the bug)
			const forgotten = forgetCard(card);

			const queue = reviewService.buildQueue([forgotten], fsrsService, {
				...defaultOptions,
				reviewedToday,
			});

			// Bug: card is New but still filtered out by reviewedToday
			expect(queue).toHaveLength(0);
		});
	});

	// ── Group 2: Forget → countByState badge counts ────────────

	describe("forget updates countByState badge counts", () => {
		it("review-state card forgotten → new count increases", () => {
			const newCard1 = createMockFlashcard({
				id: "new-1",
				fsrs: { state: State.New },
			});
			const newCard2 = createMockFlashcard({
				id: "new-2",
				fsrs: { state: State.New },
			});
			const reviewCard = createDueReviewCard("rev-1");
			const reviewedToday = new Set(["rev-1"]);

			// Before forget: review card filtered by reviewedToday
			let counts = countByState(
				[newCard1, newCard2, reviewCard],
				reviewedToday,
				4,
			);
			expect(counts).toEqual({ new: 2, learning: 0, review: 0 });

			// Forget the review card + remove from reviewedToday
			const forgotten = forgetCard(reviewCard);
			reviewedToday.delete("rev-1");

			// After forget: card is New, not in reviewedToday → new count = 3
			counts = countByState(
				[newCard1, newCard2, forgotten],
				reviewedToday,
				4,
			);
			expect(counts).toEqual({ new: 3, learning: 0, review: 0 });
		});

		it("learning card forgotten → learning decreases, new increases", () => {
			const learningCard = createMockFlashcard({
				id: "learn-1",
				fsrs: { state: State.Learning, learningStep: 1 },
			});

			let counts = countByState([learningCard], new Set(), 4);
			expect(counts).toEqual({ new: 0, learning: 1, review: 0 });

			// Forget resets to New
			const forgotten = forgetCard(learningCard);
			counts = countByState([forgotten], new Set(), 4);
			expect(counts).toEqual({ new: 1, learning: 0, review: 0 });
		});

		it("relearning card forgotten → learning decreases, new increases", () => {
			const relearningCard = createMockFlashcard({
				id: "relearn-1",
				fsrs: {
					state: State.Relearning,
					learningStep: 0,
					lapses: 2,
					reps: 10,
				},
			});

			let counts = countByState([relearningCard], new Set(), 4);
			expect(counts).toEqual({ new: 0, learning: 1, review: 0 });

			const forgotten = forgetCard(relearningCard);
			counts = countByState([forgotten], new Set(), 4);
			expect(counts).toEqual({ new: 1, learning: 0, review: 0 });
		});

		it("suspended card forgotten → unsuspended and counted as new", () => {
			const suspendedCard = createMockFlashcard({
				id: "susp-1",
				fsrs: { state: State.Review, suspended: true },
			});

			// Suspended cards are excluded from counts
			let counts = countByState([suspendedCard], new Set(), 4);
			expect(counts).toEqual({ new: 0, learning: 0, review: 0 });

			// Forget clears suspended flag
			const forgotten = forgetCard(suspendedCard);
			expect(forgotten.fsrs.suspended).toBe(false);
			counts = countByState([forgotten], new Set(), 4);
			expect(counts).toEqual({ new: 1, learning: 0, review: 0 });
		});

		it("review card NOT in reviewedToday forgotten → review decreases, new increases", () => {
			const reviewCard = createDueReviewCard("rev-1");

			// Card due but not yet reviewed today
			let counts = countByState([reviewCard], new Set(), 4);
			expect(counts).toEqual({ new: 0, learning: 0, review: 1 });

			const forgotten = forgetCard(reviewCard);
			counts = countByState([forgotten], new Set(), 4);
			expect(counts).toEqual({ new: 1, learning: 0, review: 0 });
		});
	});

	// ── Group 3: Undo forget → re-added to reviewedToday ───────

	describe("undo forget re-adds to reviewedToday", () => {
		it("forget then undo → card back in reviewedToday, excluded from queue", () => {
			const originalCard = createDueReviewCard("card-1");
			const reviewedToday = new Set(["card-1"]);

			// Forget: remove from reviewedToday
			const forgotten = forgetCard(originalCard);
			reviewedToday.delete("card-1");
			expect(reviewedToday.has("card-1")).toBe(false);

			// Verify forgotten card IS in queue
			let queue = reviewService.buildQueue([forgotten], fsrsService, {
				...defaultOptions,
				reviewedToday,
			});
			expect(queue).toHaveLength(1);

			// Undo: restore original FSRS state + re-add to reviewedToday
			reviewedToday.add("card-1");

			// Card excluded from queue again
			queue = reviewService.buildQueue([originalCard], fsrsService, {
				...defaultOptions,
				reviewedToday,
			});
			expect(queue).toHaveLength(0);
		});

		it("forget then undo → badge counts restored", () => {
			const reviewCard = createDueReviewCard("rev-1");
			const reviewedToday = new Set(["rev-1"]);

			// Before: reviewed today, excluded from counts
			let counts = countByState([reviewCard], reviewedToday, 4);
			expect(counts).toEqual({ new: 0, learning: 0, review: 0 });

			// Forget
			const forgotten = forgetCard(reviewCard);
			reviewedToday.delete("rev-1");
			counts = countByState([forgotten], reviewedToday, 4);
			expect(counts).toEqual({ new: 1, learning: 0, review: 0 });

			// Undo
			reviewedToday.add("rev-1");
			counts = countByState([reviewCard], reviewedToday, 4);
			expect(counts).toEqual({ new: 0, learning: 0, review: 0 });
		});
	});

	// ── Group 4: FSRS state reset verification ─────────────────

	describe("forget resets all FSRS fields", () => {
		it("all scheduling fields reset to initial values", () => {
			const card = createMockFlashcard({
				id: "card-1",
				fsrs: {
					state: State.Review,
					stability: 15.5,
					difficulty: 7.3,
					reps: 12,
					lapses: 3,
					scheduledDays: 14,
					learningStep: 2,
					lastReview: new Date().toISOString(),
					suspended: true,
					buriedUntil: new Date(
						Date.now() + 86400000,
					).toISOString(),
				},
			});

			const forgotten = forgetCard(card);

			expect(forgotten.fsrs.state).toBe(State.New);
			expect(forgotten.fsrs.stability).toBe(0);
			expect(forgotten.fsrs.difficulty).toBe(0);
			expect(forgotten.fsrs.reps).toBe(0);
			expect(forgotten.fsrs.lapses).toBe(0);
			expect(forgotten.fsrs.scheduledDays).toBe(0);
			expect(forgotten.fsrs.learningStep).toBe(0);
			expect(forgotten.fsrs.lastReview).toBeNull();
			expect(forgotten.fsrs.suspended).toBe(false);
			expect(forgotten.fsrs.buriedUntil).toBeUndefined();
		});
	});

	// ── Group 5: Edge cases ────────────────────────────────────

	describe("edge cases", () => {
		it("forget New card → stays New, no effect on counts", () => {
			const newCard = createMockFlashcard({
				id: "new-1",
				fsrs: { state: State.New },
			});

			const forgotten = forgetCard(newCard);
			expect(forgotten.fsrs.state).toBe(State.New);

			const counts = countByState([forgotten], new Set(), 4);
			expect(counts).toEqual({ new: 1, learning: 0, review: 0 });
		});

		it("forget card not in reviewedToday → no crash, still works", () => {
			const card = createDueReviewCard("card-1");
			const reviewedToday = new Set<string>(); // not in set

			// Card not reviewed today — deleting from empty set is no-op
			reviewedToday.delete("card-1");

			const forgotten = forgetCard(card);
			const queue = reviewService.buildQueue([forgotten], fsrsService, {
				...defaultOptions,
				reviewedToday,
			});
			expect(queue).toHaveLength(1);
		});

		it("forget all cards from a note → all become New and available", () => {
			const cards = Array.from({ length: 5 }, (_, i) =>
				createDueReviewCard(`card-${i + 1}`),
			);
			const reviewedToday = new Set(
				cards.slice(0, 3).map((c) => c.id),
			);

			// Forget all 5
			const forgottenCards = cards.map(forgetCard);
			for (const c of cards) {
				reviewedToday.delete(c.id);
			}

			// All 5 should be New
			for (const c of forgottenCards) {
				expect(c.fsrs.state).toBe(State.New);
			}

			// All 5 available in queue
			const queue = reviewService.buildQueue(
				forgottenCards,
				fsrsService,
				{ ...defaultOptions, reviewedToday },
			);
			expect(queue).toHaveLength(5);

			// Badge counts: all New
			const counts = countByState(forgottenCards, reviewedToday, 4);
			expect(counts).toEqual({ new: 5, learning: 0, review: 0 });
		});

		it("learning cards in reviewedToday are NOT excluded (can be reviewed multiple times)", () => {
			const learningCard = createMockFlashcard({
				id: "learn-1",
				fsrs: {
					state: State.Learning,
					due: new Date(Date.now() - 60000).toISOString(),
				},
			});
			const reviewedToday = new Set(["learn-1"]);

			// Learning cards bypass reviewedToday filter
			const queue = reviewService.buildQueue(
				[learningCard],
				fsrsService,
				{ ...defaultOptions, reviewedToday },
			);
			expect(queue).toHaveLength(1);

			// countByState also counts learning cards despite reviewedToday
			const counts = countByState([learningCard], reviewedToday, 4);
			expect(counts).toEqual({ new: 0, learning: 1, review: 0 });
		});
	});
});
