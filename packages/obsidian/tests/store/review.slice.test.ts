import { Rating, State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppStore } from "../../src/store";
import {
	countRemainingCards,
	createMockCard,
	createMockCardWithState,
	createTestStore,
} from "./test-helpers";

describe("Review Slice", () => {
	let store: AppStore;

	beforeEach(() => {
		store = createTestStore();
	});

	describe("Session Lifecycle", () => {
		it("keeps concurrently open session stores isolated", () => {
			const otherStore = createTestStore();
			const firstCard = createMockCard({ id: "first-session" });
			const secondCard = createMockCard({ id: "second-session" });

			store.getState().review.startSession([firstCard]);
			otherStore.getState().review.startSession([secondCard]);
			store.getState().review.revealAnswer();

			expect(store.getState().review.getCurrentCard()?.id).toBe(
				"first-session",
			);
			expect(store.getState().review.isAnswerRevealed).toBe(true);
			expect(otherStore.getState().review.getCurrentCard()?.id).toBe(
				"second-session",
			);
			expect(otherStore.getState().review.isAnswerRevealed).toBe(false);
		});

		it("should start with idle state", () => {
			const review = store.getState().review;
			expect(review.isActive).toBe(false);
			expect(review.queue).toHaveLength(0);
			expect(review.currentIndex).toBe(0);
		});

		it("should start a session with cards", () => {
			const cards = [createMockCard(), createMockCard(), createMockCard()];

			store.getState().review.startSession(cards);

			const review = store.getState().review;
			expect(review.isActive).toBe(true);
			expect(review.queue).toHaveLength(3);
			expect(review.currentIndex).toBe(0);
			expect(review.isAnswerRevealed).toBe(false);
		});

		it("should end a session and calculate duration", () => {
			const cards = [createMockCard()];
			store.getState().review.startSession(cards);

			store.getState().review.endSession();

			const review = store.getState().review;
			expect(review.isActive).toBe(false);
			expect(review.stats.duration).toBeGreaterThanOrEqual(0);
		});

		it("should reset to initial state", () => {
			const cards = [createMockCard(), createMockCard()];
			store.getState().review.startSession(cards);
			store.getState().review.revealAnswer();
			store
				.getState()
				.review.setSessionFilters({ projectPath: "Projects/A.md" });

			store.getState().review.reset();

			const review = store.getState().review;
			expect(review.isActive).toBe(false);
			expect(review.queue).toHaveLength(0);
			expect(review.isAnswerRevealed).toBe(false);
			expect(review.getSessionFilters()).toEqual({});
		});
	});

	describe("Answer Display", () => {
		it("should reveal answer", () => {
			const cards = [createMockCard()];
			store.getState().review.startSession(cards);

			store.getState().review.revealAnswer();

			expect(store.getState().review.isAnswerRevealed).toBe(true);
		});

		it("should hide answer", () => {
			const cards = [createMockCard()];
			store.getState().review.startSession(cards);
			store.getState().review.revealAnswer();

			store.getState().review.hideAnswer();

			expect(store.getState().review.isAnswerRevealed).toBe(false);
		});

		it("should not reveal answer if session is not active", () => {
			store.getState().review.revealAnswer();
			expect(store.getState().review.isAnswerRevealed).toBe(false);
		});
	});

	describe("Card Navigation", () => {
		it("should move to next card", () => {
			const cards = [createMockCard(), createMockCard()];
			store.getState().review.startSession(cards);

			const hasMore = store.getState().review.nextCard();

			expect(hasMore).toBe(true);
			expect(store.getState().review.currentIndex).toBe(1);
		});

		it("should return false when no more cards", () => {
			const cards = [createMockCard()];
			store.getState().review.startSession(cards);

			const hasMore = store.getState().review.nextCard();

			expect(hasMore).toBe(false);
			expect(store.getState().review.currentIndex).toBe(1);
		});

		it("should hide answer on next card", () => {
			const cards = [createMockCard(), createMockCard()];
			store.getState().review.startSession(cards);
			store.getState().review.revealAnswer();

			store.getState().review.nextCard();

			expect(store.getState().review.isAnswerRevealed).toBe(false);
		});
	});

	describe("Badge Counts", () => {
		it("should compute initial badge counts correctly", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.New),
				createMockCardWithState(State.Learning),
				createMockCardWithState(State.Review),
				createMockCardWithState(State.Relearning),
			];

			store.getState().review.startSession(cards);

			const counts = store.getState().review.getBadgeCounts();
			expect(counts.new).toBe(2);
			expect(counts.learning).toBe(2); // Learning + Relearning
			expect(counts.due).toBe(1); // Review
		});

		it("should decrement badge count on nextCard", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.Learning),
			];

			store.getState().review.startSession(cards);
			const initialCounts = store.getState().review.getBadgeCounts();
			expect(initialCounts.new).toBe(1);

			store.getState().review.nextCard();

			const afterCounts = store.getState().review.getBadgeCounts();
			expect(afterCounts.new).toBe(0);
			expect(afterCounts.learning).toBe(1);
		});

		it("should update badge counts on recordAnswerAndNext", () => {
			const card = createMockCardWithState(State.New);
			store
				.getState()
				.review.startSession([card, createMockCardWithState(State.Review)]);

			const updatedCard = {
				...card,
				fsrs: { ...card.fsrs, state: State.Learning },
			};

			store.getState().review.recordAnswerAndNext(Rating.Good, updatedCard);

			const counts = store.getState().review.getBadgeCounts();
			expect(counts.new).toBe(0);
			expect(counts.due).toBe(1);
		});

		it("should update badge counts when card is requeued", () => {
			const card = createMockCardWithState(State.New);
			store
				.getState()
				.review.startSession([card, createMockCardWithState(State.Review)]);

			const updatedCard = {
				...card,
				fsrs: { ...card.fsrs, state: State.Learning },
			};
			const requeuedCard = {
				...card,
				id: "requeued",
				fsrs: { ...card.fsrs, state: State.Learning },
			};

			store.getState().review.recordAnswerAndNext(Rating.Again, updatedCard, {
				card: requeuedCard,
				position: 2,
			});

			const counts = store.getState().review.getBadgeCounts();
			// Original new card removed (-1 new), requeued learning card added (+1 learning)
			expect(counts.new).toBe(0);
			expect(counts.learning).toBe(1);
			expect(counts.due).toBe(1);
		});

		it("should increment badge count when adding card to queue", () => {
			const cards = [createMockCardWithState(State.New)];
			store.getState().review.startSession(cards);

			const newCard = createMockCardWithState(State.Learning);
			store.getState().review.addCardToQueue(newCard);

			const counts = store.getState().review.getBadgeCounts();
			expect(counts.new).toBe(1);
			expect(counts.learning).toBe(1);
		});

		it("should decrement badge count when removing current card", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.Learning),
			];
			store.getState().review.startSession(cards);

			store.getState().review.removeCurrentCard();

			const counts = store.getState().review.getBadgeCounts();
			expect(counts.new).toBe(0);
			expect(counts.learning).toBe(1);
		});

		it("should return copy of badge counts (not reference)", () => {
			const cards = [createMockCardWithState(State.New)];
			store.getState().review.startSession(cards);

			const counts1 = store.getState().review.getBadgeCounts();
			const counts2 = store.getState().review.getBadgeCounts();

			expect(counts1).not.toBe(counts2);
			expect(counts1).toEqual(counts2);
		});

		it("should return zeros for empty queue", () => {
			store.getState().review.startSession([]);

			const counts = store.getState().review.getBadgeCounts();
			expect(counts.new).toBe(0);
			expect(counts.learning).toBe(0);
			expect(counts.due).toBe(0);
		});

		it("should NOT decrement count when removing card before current index", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.Review),
			];
			store.getState().review.startSession(cards);
			store.getState().review.nextCard(); // Move to index 1

			const countsBefore = store.getState().review.getBadgeCounts();
			expect(countsBefore.due).toBe(1);

			// Remove the New card which is before current index
			store.getState().review.removeCardById(cards[0]?.id);

			// Count should stay the same (card was already passed)
			const countsAfter = store.getState().review.getBadgeCounts();
			expect(countsAfter.due).toBe(1);
		});

		it("should handle batch removal and update badge counts", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.Review),
				createMockCardWithState(State.Review),
				createMockCardWithState(State.New),
			];
			store.getState().review.startSession(cards);

			const countsBefore = store.getState().review.getBadgeCounts();
			expect(countsBefore.new).toBe(2);
			expect(countsBefore.due).toBe(2);

			// Remove all review cards
			store.getState().review.removeCardsByIds([cards[1]?.id, cards[2]?.id]);

			const countsAfter = store.getState().review.getBadgeCounts();
			expect(countsAfter.new).toBe(2);
			expect(countsAfter.due).toBe(0);
		});

		it("should replace the active queue while keeping the same current card when possible", () => {
			const keptCard = createMockCardWithState(State.Review);
			const cards = [
				createMockCardWithState(State.New),
				keptCard,
				createMockCardWithState(State.Learning),
			];
			store.getState().review.startSession(cards);
			store.getState().review.nextCard();

			const replacement = [
				createMockCardWithState(State.New),
				keptCard,
				createMockCardWithState(State.Review),
			];

			store.getState().review.replaceQueue(replacement, keptCard.id);

			const review = store.getState().review;
			expect(review.getCurrentCard()?.id).toBe(keptCard.id);
			expect(review.currentIndex).toBe(1);
			expect(review.getBadgeCounts()).toEqual({
				new: 0,
				learning: 0,
				due: 2,
			});
		});

		it("should not count requeue if inserted before current index", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.Review),
			];
			store.getState().review.startSession(cards);
			store.getState().review.nextCard(); // At index 1 now

			const countsBefore = store.getState().review.getBadgeCounts();
			expect(countsBefore.learning).toBe(0);

			// Requeue at position 0 (before current index)
			const requeuedCard = createMockCardWithState(State.Learning);
			store.getState().review.requeueCard(requeuedCard, 0);

			// Since inserted before current index, shouldn't affect remaining counts
			const countsAfter = store.getState().review.getBadgeCounts();
			expect(countsAfter.learning).toBe(0);
		});

		it("should update badge count when requeue at specific position after current", () => {
			const cards = [
				createMockCardWithState(State.Learning),
				createMockCardWithState(State.New),
				createMockCardWithState(State.Review),
			];
			store.getState().review.startSession(cards);

			const countsBefore = store.getState().review.getBadgeCounts();
			expect(countsBefore.learning).toBe(1);

			// Requeue learning card at position 2 (after current, before review)
			const requeuedCard = createMockCardWithState(State.Learning);
			store.getState().review.requeueCard(requeuedCard, 2);

			const countsAfter = store.getState().review.getBadgeCounts();
			expect(countsAfter.learning).toBe(2);
		});

		it("should restore badge counts correctly on undo with requeued card", () => {
			const card = createMockCardWithState(State.Learning);
			store
				.getState()
				.review.startSession([card, createMockCardWithState(State.Review)]);

			const countsBefore = store.getState().review.getBadgeCounts();
			expect(countsBefore.learning).toBe(1);
			expect(countsBefore.due).toBe(1);

			// Answer and requeue
			const updatedCard = {
				...card,
				fsrs: { ...card.fsrs, state: State.Learning },
			};
			const requeuedCard = { ...updatedCard, id: "requeued" };
			store.getState().review.recordAnswerAndNext(Rating.Again, updatedCard, {
				card: requeuedCard,
				position: 2,
			});

			// Undo with requeue removal
			store.getState().review.undoLastAnswer(0, card, 2);

			const countsAfter = store.getState().review.getBadgeCounts();
			expect(countsAfter.learning).toBe(1);
			expect(countsAfter.due).toBe(1);
		});
	});

	describe("Badge Count Consistency", () => {
		it("should stay consistent after 10 transitions", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.New),
				createMockCardWithState(State.Learning),
				createMockCardWithState(State.Review),
				createMockCardWithState(State.Review),
				createMockCardWithState(State.New),
				createMockCardWithState(State.Learning),
				createMockCardWithState(State.Review),
				createMockCardWithState(State.Review),
				createMockCardWithState(State.Review),
			];

			store.getState().review.startSession(cards);

			// Verify after each transition
			for (let i = 0; i < 10; i++) {
				const state = store.getState().review;
				const manualCounts = countRemainingCards(
					state.queue,
					state.currentIndex,
				);
				const badgeCounts = state.getBadgeCounts();

				expect(badgeCounts.new).toBe(manualCounts.new);
				expect(badgeCounts.learning).toBe(manualCounts.learning);
				expect(badgeCounts.due).toBe(manualCounts.due);

				if (store.getState().review.nextCard() === false) break;
			}
		});

		it("should match full recount at any point", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.Learning),
				createMockCardWithState(State.Review),
				createMockCardWithState(State.New),
				createMockCardWithState(State.Review),
			];

			store.getState().review.startSession(cards);

			// Move to middle of queue
			store.getState().review.nextCard();
			store.getState().review.nextCard();

			// Get badge counts via O(1) method
			const cached = store.getState().review.getBadgeCounts();

			// Manually count remaining cards
			const state = store.getState().review;
			const manual = countRemainingCards(state.queue, state.currentIndex);

			expect(cached.new).toBe(manual.new);
			expect(cached.learning).toBe(manual.learning);
			expect(cached.due).toBe(manual.due);
		});

		it("should never go negative", () => {
			const cards = [createMockCardWithState(State.New)];

			store.getState().review.startSession(cards);

			store.getState().review.nextCard();
			store.getState().review.nextCard(); // Try to advance again

			const counts = store.getState().review.getBadgeCounts();
			expect(counts.new).toBeGreaterThanOrEqual(0);
			expect(counts.learning).toBeGreaterThanOrEqual(0);
			expect(counts.due).toBeGreaterThanOrEqual(0);
		});

		it("should handle all cards of same type", () => {
			const cards = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.New),
				createMockCardWithState(State.New),
			];

			store.getState().review.startSession(cards);
			expect(store.getState().review.getBadgeCounts().new).toBe(3);

			store.getState().review.nextCard();
			expect(store.getState().review.getBadgeCounts().new).toBe(2);

			store.getState().review.nextCard();
			expect(store.getState().review.getBadgeCounts().new).toBe(1);

			store.getState().review.nextCard();
			expect(store.getState().review.getBadgeCounts().new).toBe(0);
		});
	});

	describe("Waiting State", () => {
		it("should detect waiting state for future learning cards", () => {
			// Create a learning card due in 5 minutes
			const card = createMockCardWithState(State.Learning, 5);
			store.getState().review.startSession([card]);

			expect(store.getState().review.isWaitingForLearningCards()).toBe(true);
		});

		it("should not be waiting for due learning cards", () => {
			// Create a learning card due now (past)
			const card = createMockCardWithState(State.Learning, -1);
			store.getState().review.startSession([card]);

			expect(store.getState().review.isWaitingForLearningCards()).toBe(false);
		});

		it("should not be waiting for review cards", () => {
			const card = createMockCardWithState(State.Review, 5);
			store.getState().review.startSession([card]);

			expect(store.getState().review.isWaitingForLearningCards()).toBe(false);
		});

		it("should calculate time until next due correctly", () => {
			const futureMinutes = 5;
			const card = createMockCardWithState(State.Learning, futureMinutes);
			store.getState().review.startSession([card]);

			const timeUntilDue = store.getState().review.getTimeUntilNextDue();

			// Should be approximately 5 minutes in milliseconds
			expect(timeUntilDue).toBeGreaterThan(4 * 60 * 1000);
			expect(timeUntilDue).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
		});

		it("should return 0 for time until due when no pending learning cards", () => {
			const card = createMockCardWithState(State.Review);
			store.getState().review.startSession([card]);

			expect(store.getState().review.getTimeUntilNextDue()).toBe(0);
		});

		it("should get pending learning cards correctly", () => {
			const learningFuture = createMockCardWithState(State.Learning, 5);
			const learningPast = createMockCardWithState(State.Learning, -1);
			const reviewCard = createMockCardWithState(State.Review);

			store
				.getState()
				.review.startSession([learningFuture, learningPast, reviewCard]);

			const pending = store.getState().review.getPendingLearningCards();
			expect(pending).toHaveLength(1);
			expect(pending[0]?.id).toBe(learningFuture.id);
		});
	});

	describe("Waiting State Boundaries", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should wait when learning card is exactly 60 min away (at boundary)", () => {
			const card = createMockCardWithState(State.Learning, 60);
			store.getState().review.startSession([card]);

			// At 60 min, timeUntilDue <= MAX_WAIT_MS (60 min), so should wait
			expect(store.getState().review.isWaitingForLearningCards()).toBe(true);
		});

		it("should NOT wait when learning card is 61 min away (beyond max wait)", () => {
			const card = createMockCardWithState(State.Learning, 61);
			store.getState().review.startSession([card]);

			// Beyond MAX_WAIT_MS, so isWaitingForLearningCards returns false
			expect(store.getState().review.isWaitingForLearningCards()).toBe(false);
		});

		it("should wait for Relearning cards same as Learning", () => {
			const card = createMockCardWithState(State.Relearning, 30);
			store.getState().review.startSession([card]);

			expect(store.getState().review.isWaitingForLearningCards()).toBe(true);
		});

		it("should return false when session is not active", () => {
			expect(store.getState().review.isWaitingForLearningCards()).toBe(false);
		});

		it("should return false when current card is Review (not Learning)", () => {
			const card = createMockCardWithState(State.Review, 30);
			store.getState().review.startSession([card]);

			expect(store.getState().review.isWaitingForLearningCards()).toBe(false);
		});

		it("should return false when Learning card is due now", () => {
			const card = createMockCardWithState(State.Learning, 0);
			store.getState().review.startSession([card]);

			expect(store.getState().review.isWaitingForLearningCards()).toBe(false);
		});

		it("should return waiting phase for 30 min future learning card", () => {
			const card = createMockCardWithState(State.Learning, 30);
			store.getState().review.startSession([card]);

			const phase = store.getState().review.getPhase();
			expect(phase.type).toBe("waiting");
			if (phase.type === "waiting") {
				expect(phase.timeUntilDue).toBeGreaterThan(29 * 60 * 1000);
			}
		});
	});

	describe("Session Phase", () => {
		it("should return idle phase when not active", () => {
			const phase = store.getState().review.getPhase();
			expect(phase.type).toBe("idle");
		});

		it("should return active phase with current card", () => {
			const card = createMockCardWithState(State.New);
			store.getState().review.startSession([card]);

			const phase = store.getState().review.getPhase();
			expect(phase.type).toBe("active");
			if (phase.type === "active") {
				expect(phase.card.id).toBe(card.id);
			}
		});

		it("should return complete phase when all cards reviewed", () => {
			const card = createMockCardWithState(State.New);
			store.getState().review.startSession([card]);
			store.getState().review.nextCard();

			const phase = store.getState().review.getPhase();
			expect(phase.type).toBe("complete");
		});

		it("should return waiting phase for future learning cards", () => {
			const card = createMockCardWithState(State.Learning, 5);
			store.getState().review.startSession([card]);

			const phase = store.getState().review.getPhase();
			expect(phase.type).toBe("waiting");
		});

		it("should return complete phase with populated stats", () => {
			const newCard = createMockCardWithState(State.New);
			const reviewCard = createMockCardWithState(State.Review);
			store.getState().review.startSession([newCard, reviewCard]);

			// Answer both cards
			store.getState().review.recordAnswerAndNext(Rating.Good, {
				...newCard,
				fsrs: { ...newCard.fsrs, state: State.Learning },
			});
			store.getState().review.recordAnswerAndNext(Rating.Easy, {
				...reviewCard,
				fsrs: { ...reviewCard.fsrs },
			});

			const phase = store.getState().review.getPhase();
			expect(phase.type).toBe("complete");
			if (phase.type === "complete") {
				expect(phase.stats.reviewed).toBe(2);
				expect(phase.stats.good).toBe(1);
				expect(phase.stats.easy).toBe(1);
				expect(phase.stats.total).toBe(2);
			}
		});
	});

	describe("Queue Manipulation", () => {
		it("should remove card by id", () => {
			const card1 = createMockCard({ id: "card-1" });
			const card2 = createMockCard({ id: "card-2" });
			store.getState().review.startSession([card1, card2]);

			store.getState().review.removeCardById("card-1");

			expect(store.getState().review.queue).toHaveLength(1);
			expect(store.getState().review.queue[0]?.id).toBe("card-2");
		});

		it("should adjust currentIndex when removing card before it", () => {
			const card1 = createMockCard({ id: "card-1" });
			const card2 = createMockCard({ id: "card-2" });
			const card3 = createMockCard({ id: "card-3" });
			store.getState().review.startSession([card1, card2, card3]);
			store.getState().review.nextCard(); // currentIndex = 1

			store.getState().review.removeCardById("card-1");

			expect(store.getState().review.currentIndex).toBe(0);
		});

		it("should remove multiple cards by ids", () => {
			const cards = [
				createMockCard({ id: "card-1" }),
				createMockCard({ id: "card-2" }),
				createMockCard({ id: "card-3" }),
			];
			store.getState().review.startSession(cards);

			store.getState().review.removeCardsByIds(["card-1", "card-3"]);

			expect(store.getState().review.queue).toHaveLength(1);
			expect(store.getState().review.queue[0]?.id).toBe("card-2");
		});

		it("should insert card at specific position", () => {
			const card1 = createMockCard({ id: "card-1" });
			const card2 = createMockCard({ id: "card-2" });
			store.getState().review.startSession([card1, card2]);

			const newCard = createMockCard({ id: "new-card" });
			store.getState().review.insertCardAtPosition(newCard, 1);

			expect(store.getState().review.queue).toHaveLength(3);
			expect(store.getState().review.queue[1]?.id).toBe("new-card");
		});

		it("should shift currentIndex when inserting before it (mirrors removeCardById)", () => {
			const cards = [
				createMockCard({ id: "card-1" }),
				createMockCard({ id: "card-2" }),
				createMockCard({ id: "card-3" }),
			];
			store.getState().review.startSession(cards);
			store.getState().review.nextCard();
			store.getState().review.nextCard();
			expect(store.getState().review.currentIndex).toBe(2);
			expect(store.getState().review.getCurrentCard()?.id).toBe("card-3");

			const inserted = createMockCard({ id: "inserted" });
			store.getState().review.insertCardAtPosition(inserted, 1);

			// currentIndex shifts +1 so user stays on card-3
			expect(store.getState().review.currentIndex).toBe(3);
			expect(store.getState().review.getCurrentCard()?.id).toBe("card-3");
		});

		it("should keep currentIndex when inserting after it", () => {
			const cards = [
				createMockCard({ id: "card-1" }),
				createMockCard({ id: "card-2" }),
			];
			store.getState().review.startSession(cards);
			expect(store.getState().review.currentIndex).toBe(0);

			const inserted = createMockCard({ id: "inserted" });
			store.getState().review.insertCardAtPosition(inserted, 2);

			expect(store.getState().review.currentIndex).toBe(0);
			expect(store.getState().review.getCurrentCard()?.id).toBe("card-1");
		});

		it("should put inserted card under cursor when position == currentIndex", () => {
			const cards = [
				createMockCard({ id: "card-1" }),
				createMockCard({ id: "card-2" }),
			];
			store.getState().review.startSession(cards);
			store.getState().review.nextCard();
			expect(store.getState().review.currentIndex).toBe(1);

			const inserted = createMockCard({ id: "inserted" });
			store.getState().review.insertCardAtPosition(inserted, 1);

			// When inserting at current position, the new card becomes current.
			// Used by undo to restore the active card.
			expect(store.getState().review.currentIndex).toBe(1);
			expect(store.getState().review.getCurrentCard()?.id).toBe("inserted");
		});

		it("should requeue card at end by default", () => {
			const card1 = createMockCard({ id: "card-1" });
			store.getState().review.startSession([card1]);

			const requeuedCard = createMockCard({ id: "requeued" });
			store.getState().review.requeueCard(requeuedCard);

			expect(store.getState().review.queue).toHaveLength(2);
			expect(store.getState().review.queue[1]?.id).toBe("requeued");
		});
	});

	describe("Undo Support", () => {
		it("should undo last answer", () => {
			const card = createMockCardWithState(State.New);
			const updatedCard = {
				...card,
				fsrs: { ...card.fsrs, state: State.Learning },
			};
			store.getState().review.startSession([card, createMockCard()]);

			store.getState().review.recordAnswerAndNext(Rating.Good, updatedCard);
			expect(store.getState().review.currentIndex).toBe(1);

			store.getState().review.undoLastAnswer(0, card);

			expect(store.getState().review.currentIndex).toBe(0);
			expect(store.getState().review.queue[0]?.fsrs.state).toBe(State.New);
		});

		it("should remove requeued card on undo", () => {
			const card = createMockCardWithState(State.New);
			store.getState().review.startSession([card]);

			const updatedCard = {
				...card,
				fsrs: { ...card.fsrs, state: State.Learning },
			};
			const requeuedCard = { ...updatedCard, id: "requeued" };

			store.getState().review.recordAnswerAndNext(Rating.Again, updatedCard, {
				card: requeuedCard,
				position: 1,
			});
			expect(store.getState().review.queue).toHaveLength(2);

			store.getState().review.undoLastAnswer(0, card, 1);

			expect(store.getState().review.queue).toHaveLength(1);
			expect(store.getState().review.currentIndex).toBe(0);
		});
	});

	describe("Edit Mode", () => {
		it("should start edit mode", () => {
			const card = createMockCard({ question: "Q1", answer: "A1" });
			store.getState().review.startSession([card]);

			store.getState().review.startEdit("question");

			const editState = store.getState().review.getEditState();
			expect(editState.active).toBe(true);
			expect(editState.field).toBe("question");
			expect(editState.originalQuestion).toBe("Q1");
		});

		it("should cancel edit mode", () => {
			const card = createMockCard();
			store.getState().review.startSession([card]);
			store.getState().review.startEdit("answer");

			store.getState().review.cancelEdit();

			const editState = store.getState().review.getEditState();
			expect(editState.active).toBe(false);
			expect(editState.field).toBeNull();
		});

		it("should update current card content", () => {
			const card = createMockCard({ question: "Old Q", answer: "Old A" });
			store.getState().review.startSession([card]);

			store.getState().review.updateCurrentCardContent("New Q", "New A");

			const currentCard = store.getState().review.getCurrentCard();
			expect(currentCard?.question).toBe("New Q");
			expect(currentCard?.answer).toBe("New A");
		});

		it("should update and clear the current card user comment", () => {
			const card = createMockCard({ userComment: "Old note" });
			store.getState().review.startSession([card]);

			store
				.getState()
				.review.updateCurrentCardComment("Check the source wording");
			expect(store.getState().review.getCurrentCard()?.userComment).toBe(
				"Check the source wording",
			);

			store.getState().review.updateCurrentCardComment(undefined);
			expect(
				store.getState().review.getCurrentCard()?.userComment,
			).toBeUndefined();
		});
	});

	describe("Progress and Stats", () => {
		it("should calculate progress correctly", () => {
			const cards = [createMockCard(), createMockCard(), createMockCard()];
			store.getState().review.startSession(cards);

			let progress = store.getState().review.getProgress();
			expect(progress.current).toBe(1);
			expect(progress.total).toBe(3);
			expect(progress.percentage).toBeCloseTo(33.33, 1);

			store.getState().review.nextCard();
			progress = store.getState().review.getProgress();
			expect(progress.current).toBe(2);
			expect(progress.percentage).toBeCloseTo(66.67, 1);
		});

		it("should calculate remaining count correctly", () => {
			const cards = [createMockCard(), createMockCard(), createMockCard()];
			store.getState().review.startSession(cards);

			expect(store.getState().review.getRemainingCount()).toBe(3);

			store.getState().review.nextCard();
			expect(store.getState().review.getRemainingCount()).toBe(2);
		});

		it("should compute stats from results", () => {
			const newCard = createMockCardWithState(State.New);
			const reviewCard = createMockCardWithState(State.Review);
			store.getState().review.startSession([newCard, reviewCard]);

			store.getState().review.recordAnswerAndNext(Rating.Good, {
				...newCard,
				fsrs: { ...newCard.fsrs, state: State.Learning },
			});
			store.getState().review.recordAnswerAndNext(Rating.Easy, {
				...reviewCard,
				fsrs: { ...reviewCard.fsrs },
			});

			const stats = store.getState().review.getStats();
			expect(stats.reviewed).toBe(2);
			expect(stats.good).toBe(1);
			expect(stats.easy).toBe(1);
			expect(stats.newCards).toBe(1);
			expect(stats.reviewCards).toBe(1);
		});
	});

	describe("Computed Getters", () => {
		it("should get current card", () => {
			const card = createMockCard({ id: "test-card" });
			store.getState().review.startSession([card]);

			const currentCard = store.getState().review.getCurrentCard();
			expect(currentCard?.id).toBe("test-card");
		});

		it("should return null for current card when session is not active", () => {
			expect(store.getState().review.getCurrentCard()).toBeNull();
		});

		it("should check if session is complete", () => {
			const card = createMockCard();
			store.getState().review.startSession([card]);

			expect(store.getState().review.isComplete()).toBe(false);

			store.getState().review.nextCard();

			expect(store.getState().review.isComplete()).toBe(true);
		});

		it("should check if answer is shown", () => {
			const card = createMockCard();
			store.getState().review.startSession([card]);

			expect(store.getState().review.isAnswerShown()).toBe(false);

			store.getState().review.revealAnswer();

			expect(store.getState().review.isAnswerShown()).toBe(true);
		});
	});

	describe("Actionable Card Promotion", () => {
		// Regression: suspending/burying/removing a card slid a not-yet-due
		// learning card under the cursor, showing the waiting screen while
		// actionable cards were still queued behind it.

		function startSessionWithPendingLearningNext() {
			const current = createMockCardWithState(State.Review);
			const pendingLearning = createMockCardWithState(State.Learning, 5); // due in 5 min
			const actionable = createMockCardWithState(State.New);
			store
				.getState()
				.review.startSession([current, pendingLearning, actionable]);
			return { current, pendingLearning, actionable };
		}

		it("should stay active after removeCardsByIds when actionable cards remain", () => {
			const { current, actionable } = startSessionWithPendingLearningNext();

			store.getState().review.removeCardsByIds([current.id]);

			expect(store.getState().review.getPhase().type).toBe("active");
			expect(store.getState().review.getCurrentCard()?.id).toBe(actionable.id);
		});

		it("should stay active after removeCardById when actionable cards remain", () => {
			const { current, actionable } = startSessionWithPendingLearningNext();

			store.getState().review.removeCardById(current.id);

			expect(store.getState().review.getPhase().type).toBe("active");
			expect(store.getState().review.getCurrentCard()?.id).toBe(actionable.id);
		});

		it("should stay active after removeCurrentCard when actionable cards remain", () => {
			const { actionable } = startSessionWithPendingLearningNext();

			store.getState().review.removeCurrentCard();

			expect(store.getState().review.getPhase().type).toBe("active");
			expect(store.getState().review.getCurrentCard()?.id).toBe(actionable.id);
		});

		it("should keep badge counts matching a full recount after promotion", () => {
			const { current } = startSessionWithPendingLearningNext();

			store.getState().review.removeCardsByIds([current.id]);

			const review = store.getState().review;
			expect(review.getBadgeCounts()).toEqual(
				countRemainingCards(review.queue, review.currentIndex),
			);
		});

		it("should wait after removal only when no actionable cards remain", () => {
			const current = createMockCardWithState(State.Review);
			const pendingLearning = createMockCardWithState(State.Learning, 5);
			store.getState().review.startSession([current, pendingLearning]);

			store.getState().review.removeCardsByIds([current.id]);

			expect(store.getState().review.getPhase().type).toBe("waiting");
		});

		it("should complete when removeCardsByIds removes the last remaining card", () => {
			const card1 = createMockCard({ id: "card-1" });
			const card2 = createMockCard({ id: "card-2" });
			store.getState().review.startSession([card1, card2]);
			store.getState().review.nextCard(); // card-1 already passed

			store.getState().review.removeCardsByIds(["card-2"]);

			// Must not point the cursor back at the already-reviewed card-1.
			expect(store.getState().review.getPhase().type).toBe("complete");
		});

		it("should complete when removeCardById removes the last remaining card", () => {
			const card1 = createMockCard({ id: "card-1" });
			const card2 = createMockCard({ id: "card-2" });
			store.getState().review.startSession([card1, card2]);
			store.getState().review.nextCard();

			store.getState().review.removeCardById("card-2");

			expect(store.getState().review.getPhase().type).toBe("complete");
		});

		it("should start the session on the first actionable card", () => {
			const pendingLearning = createMockCardWithState(State.Learning, 10);
			const actionable = createMockCardWithState(State.Review);
			store.getState().review.startSession([pendingLearning, actionable]);

			expect(store.getState().review.getPhase().type).toBe("active");
			expect(store.getState().review.getCurrentCard()?.id).toBe(actionable.id);
		});

		it("adds Top Up cards without discarding pending learning cards or results", () => {
			const reviewed = createMockCardWithState(State.Review);
			const pendingLearning = createMockCardWithState(State.Learning, 10);
			store.getState().review.startSession([reviewed, pendingLearning]);
			store.getState().review.recordAnswerAndNext(Rating.Good, reviewed);
			expect(store.getState().review.getPhase().type).toBe("waiting");

			const topUpCard = createMockCardWithState(State.New);
			const added = store
				.getState()
				.review.addCardsToCurrentSession([topUpCard]);

			const review = store.getState().review;
			expect(added).toBe(1);
			expect(review.getPhase().type).toBe("active");
			expect(review.getCurrentCard()?.id).toBe(topUpCard.id);
			expect(review.getPendingLearningCards().map((card) => card.id)).toEqual([
				pendingLearning.id,
			]);
			expect(review.results).toHaveLength(1);
		});

		it("does not add duplicate Top Up cards", () => {
			const pendingLearning = createMockCardWithState(State.Learning, 10);
			const topUpCard = createMockCardWithState(State.Review);
			store.getState().review.startSession([pendingLearning]);

			const added = store
				.getState()
				.review.addCardsToCurrentSession([topUpCard, topUpCard]);
			const addedAgain = store
				.getState()
				.review.addCardsToCurrentSession([topUpCard]);

			expect(added).toBe(1);
			expect(addedAgain).toBe(0);
			expect(
				store
					.getState()
					.review.queue.filter((card) => card.id === topUpCard.id),
			).toHaveLength(1);
		});

		it("should land on an actionable card when replaceQueue cannot preserve the current card", () => {
			const initial = createMockCardWithState(State.Review);
			store.getState().review.startSession([initial]);

			const pendingLearning = createMockCardWithState(State.Learning, 10);
			const actionable = createMockCardWithState(State.New);
			store
				.getState()
				.review.replaceQueue([pendingLearning, actionable], "missing-id");

			expect(store.getState().review.getPhase().type).toBe("active");
			expect(store.getState().review.getCurrentCard()?.id).toBe(actionable.id);
		});
	});

	describe("Pending Learning Card Skip", () => {
		it("should swap pending learning card at nextIndex with first actionable card", () => {
			const reviewCard1 = createMockCardWithState(State.Review);
			const reviewCard2 = createMockCardWithState(State.Review);
			const reviewCard3 = createMockCardWithState(State.Review);

			store
				.getState()
				.review.startSession([reviewCard1, reviewCard2, reviewCard3]);

			// Answer first card with requeue - relearning card goes to position 1 (nextIndex)
			const updatedCard = {
				...reviewCard1,
				fsrs: { ...reviewCard1.fsrs, state: State.Relearning },
			};
			const relearningCard = createMockCardWithState(State.Relearning, 5); // due in 5 min

			store.getState().review.recordAnswerAndNext(Rating.Again, updatedCard, {
				card: relearningCard,
				position: 1,
			});

			// Phase should be "active" (showing a due review card), NOT "waiting"
			const phase = store.getState().review.getPhase();
			expect(phase.type).toBe("active");
		});

		it("should show waiting when ALL remaining cards are pending learning", () => {
			const reviewCard = createMockCardWithState(State.Review);

			store.getState().review.startSession([reviewCard]);

			// Answer and requeue as only card - no other actionable cards remain
			const updatedCard = {
				...reviewCard,
				fsrs: { ...reviewCard.fsrs, state: State.Relearning },
			};
			const relearningCard = createMockCardWithState(State.Relearning, 5);

			store.getState().review.recordAnswerAndNext(Rating.Again, updatedCard, {
				card: relearningCard,
				position: 1,
			});

			const phase = store.getState().review.getPhase();
			expect(phase.type).toBe("waiting");
		});

		it("should update requeueData.position when requeued card is swapped", () => {
			const reviewCard1 = createMockCardWithState(State.Review);
			const reviewCard2 = createMockCardWithState(State.Review);

			store.getState().review.startSession([reviewCard1, reviewCard2]);

			const updatedCard = {
				...reviewCard1,
				fsrs: { ...reviewCard1.fsrs, state: State.Relearning },
			};
			const relearningCard = createMockCardWithState(State.Relearning, 5);

			// Requeue at position 1 (nextIndex). After swap, the relearning card
			// should be at position 2, and reviewCard2 at position 1.
			const requeueData = { card: relearningCard, position: 1 };
			store
				.getState()
				.review.recordAnswerAndNext(Rating.Again, updatedCard, requeueData);

			// requeueData.position should have been updated to reflect the swap
			expect(requeueData.position).toBe(2);

			// The queue should have reviewCard2 at index 1 (current) and relearning at index 2
			const state = store.getState().review;
			expect(state.queue[1]?.fsrs.state).toBe(State.Review);
			expect(state.queue[2]?.fsrs.state).toBe(State.Relearning);
		});
	});
});
