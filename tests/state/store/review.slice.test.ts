import { describe, it, expect, beforeEach } from "vitest";
import { State, Rating } from "ts-fsrs";
import { createTestStore, createMockCard, createMockCardWithState } from "./test-helpers";
import type { AppStore } from "../../../src/state/store";

describe("Review Slice", () => {
	let store: AppStore;

	beforeEach(() => {
		store = createTestStore();
	});

	describe("Session Lifecycle", () => {
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

			store.getState().review.reset();

			const review = store.getState().review;
			expect(review.isActive).toBe(false);
			expect(review.queue).toHaveLength(0);
			expect(review.isAnswerRevealed).toBe(false);
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
			store.getState().review.startSession([card, createMockCardWithState(State.Review)]);

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
			store.getState().review.startSession([card, createMockCardWithState(State.Review)]);

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

			store.getState().review.startSession([learningFuture, learningPast, reviewCard]);

			const pending = store.getState().review.getPendingLearningCards();
			expect(pending).toHaveLength(1);
			expect(pending[0]?.id).toBe(learningFuture.id);
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
			const updatedCard = { ...card, fsrs: { ...card.fsrs, state: State.Learning } };
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

			const updatedCard = { ...card, fsrs: { ...card.fsrs, state: State.Learning } };
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

			store.getState().review.recordAnswerAndNext(
				Rating.Good,
				{ ...newCard, fsrs: { ...newCard.fsrs, state: State.Learning } }
			);
			store.getState().review.recordAnswerAndNext(
				Rating.Easy,
				{ ...reviewCard, fsrs: { ...reviewCard.fsrs } }
			);

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
});
