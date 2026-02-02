/**
 * Badge Count Tests
 * Behavior-first tests for badge count accuracy in review sessions
 *
 * These tests verify:
 * - Badge counts are computed correctly at session start
 * - Counts are updated incrementally (O(1)) on card transitions
 * - Counts remain consistent after multiple operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { State, Rating } from "ts-fsrs";
import { ReviewStateManager, type BadgeCounts } from "../../src/state/review.state";
import type { FSRSFlashcardItem } from "../../src/types";
import { createMockFlashcard } from "../services/mocks/fsrs.mocks";

/**
 * Create a card with specific state
 */
function createCardWithState(
	id: string,
	state: State
): FSRSFlashcardItem {
	const due = new Date();
	return createMockFlashcard({
		id,
		fsrs: {
			state,
			due: due.toISOString(),
			stability: state === State.Review ? 7 : 0.4,
			difficulty: 5,
		},
	});
}

/**
 * Helper to compare badge counts
 */
function expectBadgeCounts(
	actual: BadgeCounts,
	expected: { new: number; learning: number; due: number }
): void {
	expect(actual.new).toBe(expected.new);
	expect(actual.learning).toBe(expected.learning);
	expect(actual.due).toBe(expected.due);
}

/**
 * Manually count cards in remaining queue (for verification)
 */
function countRemainingCards(
	queue: FSRSFlashcardItem[],
	currentIndex: number
): BadgeCounts {
	const counts: BadgeCounts = { new: 0, learning: 0, due: 0 };

	for (let i = currentIndex; i < queue.length; i++) {
		const card = queue[i];
		if (!card) continue;

		switch (card.fsrs.state) {
			case State.New:
				counts.new++;
				break;
			case State.Learning:
			case State.Relearning:
				counts.learning++;
				break;
			case State.Review:
				counts.due++;
				break;
		}
	}

	return counts;
}

describe("Review State - Badge Counts", () => {
	let stateManager: ReviewStateManager;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
		stateManager = new ReviewStateManager();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("Badge Count Initialization", () => {
		it("should initialize counts from queue at session start", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("new2", State.New),
				createCardWithState("learning1", State.Learning),
				createCardWithState("review1", State.Review),
				createCardWithState("review2", State.Review),
				createCardWithState("review3", State.Review),
			];

			stateManager.startSession(queue);

			expectBadgeCounts(stateManager.getBadgeCounts(), {
				new: 2,
				learning: 1,
				due: 3,
			});
		});

		it("should return zeros for empty queue", () => {
			stateManager.startSession([]);

			expectBadgeCounts(stateManager.getBadgeCounts(), {
				new: 0,
				learning: 0,
				due: 0,
			});
		});

		it("should count Relearning cards as learning", () => {
			const queue = [
				createCardWithState("learning1", State.Learning),
				createCardWithState("relearning1", State.Relearning),
				createCardWithState("relearning2", State.Relearning),
			];

			stateManager.startSession(queue);

			expectBadgeCounts(stateManager.getBadgeCounts(), {
				new: 0,
				learning: 3, // All 3 should count as learning
				due: 0,
			});
		});
	});

	describe("Badge Count Decrement on Next Card", () => {
		it("should decrement new count when advancing past New card", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("new2", State.New),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 2, learning: 0, due: 0 });

			stateManager.nextCard();
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 0 });
		});

		it("should decrement learning count when advancing past Learning card", () => {
			const queue = [
				createCardWithState("learning1", State.Learning),
				createCardWithState("review1", State.Review),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 1, due: 1 });

			stateManager.nextCard();
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 1 });
		});

		it("should decrement due count when advancing past Review card", () => {
			const queue = [
				createCardWithState("review1", State.Review),
				createCardWithState("review2", State.Review),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 2 });

			stateManager.nextCard();
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 1 });
		});
	});

	describe("Badge Count with Record Answer and Next", () => {
		it("should decrement count when using recordAnswerAndNext", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("review1", State.Review),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 1 });

			// Simulate answering the new card (it graduates to learning in real flow)
			const updatedCard = createCardWithState("new1", State.Learning);
			stateManager.recordAnswerAndNext(Rating.Good, updatedCard);

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 1 });
		});

		it("should handle requeue: decrement old, increment new", () => {
			const queue = [
				createCardWithState("learning1", State.Learning),
				createCardWithState("review1", State.Review),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 1, due: 1 });

			// Answer learning card - it stays in learning and gets requeued
			const updatedCard = createCardWithState("learning1", State.Learning);
			const requeuedCard = createCardWithState("learning1-requeued", State.Learning);

			stateManager.recordAnswerAndNext(Rating.Again, updatedCard, {
				card: requeuedCard,
				position: 2, // After the review card
			});

			// Decrement for card leaving + increment for requeue = net 0 for learning
			// But we moved past the learning card, so it should be:
			// Original: learning=1, due=1
			// After: decrement learning (was at index 0), increment for requeue
			// Net: learning = 0 + 1 = 1, due = 1
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 1, due: 1 });
		});
	});

	describe("Badge Count with Remove Card", () => {
		it("should decrement count when removing current card", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("new2", State.New),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 2, learning: 0, due: 0 });

			stateManager.removeCurrentCard();

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 0 });
		});

		it("should decrement count when removing card by ID in remaining queue", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("review1", State.Review),
				createCardWithState("review2", State.Review),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 2 });

			stateManager.removeCardById("review1");

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 1 });
		});

		it("should NOT decrement count when removing card before current index", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("review1", State.Review),
			];

			stateManager.startSession(queue);
			stateManager.nextCard(); // Move to review1

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 1 });

			// Remove the new1 card which is before current index
			stateManager.removeCardById("new1");

			// Count should stay the same (card was already passed)
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 1 });
		});
	});

	describe("Badge Count with Undo", () => {
		it("should restore count when undoing", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("review1", State.Review),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 1 });

			// Move past new card
			stateManager.nextCard();
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 1 });

			// Undo - restore new card
			const restoredCard = createCardWithState("new1", State.New);
			stateManager.undoLastAnswer(0, restoredCard);

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 1 });
		});

		it("should handle undo with requeued card removal", () => {
			const queue = [
				createCardWithState("learning1", State.Learning),
				createCardWithState("review1", State.Review),
				createCardWithState("learning1-requeued", State.Learning), // Requeued copy
			];

			stateManager.startSession(queue);
			stateManager.nextCard(); // Moved past learning1

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 1, due: 1 });

			// Undo with requeue removal
			const restoredCard = createCardWithState("learning1", State.Learning);
			stateManager.undoLastAnswer(0, restoredCard, 2); // requeuedAtIndex = 2

			// Original learning1 restored, requeued copy removed
			// Net: +1 for restored, -1 for removed requeue = same learning count
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 1, due: 1 });
		});
	});

	describe("Badge Count Consistency", () => {
		it("should stay consistent after 10 transitions", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("new2", State.New),
				createCardWithState("learning1", State.Learning),
				createCardWithState("review1", State.Review),
				createCardWithState("review2", State.Review),
				createCardWithState("new3", State.New),
				createCardWithState("learning2", State.Learning),
				createCardWithState("review3", State.Review),
				createCardWithState("review4", State.Review),
				createCardWithState("review5", State.Review),
			];

			stateManager.startSession(queue);

			// Verify after each transition
			for (let i = 0; i < 10; i++) {
				const state = stateManager.getState();
				const manualCounts = countRemainingCards(state.queue, state.currentIndex);
				const badgeCounts = stateManager.getBadgeCounts();

				expect(badgeCounts.new).toBe(manualCounts.new);
				expect(badgeCounts.learning).toBe(manualCounts.learning);
				expect(badgeCounts.due).toBe(manualCounts.due);

				if (stateManager.nextCard() === false) break;
			}
		});

		it("should match full recount at any point", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("learning1", State.Learning),
				createCardWithState("review1", State.Review),
				createCardWithState("new2", State.New),
				createCardWithState("review2", State.Review),
			];

			stateManager.startSession(queue);

			// Move to middle of queue
			stateManager.nextCard();
			stateManager.nextCard();

			// Get badge counts via O(1) method
			const cached = stateManager.getBadgeCounts();

			// Manually count remaining cards
			const state = stateManager.getState();
			const manual = countRemainingCards(state.queue, state.currentIndex);

			expectBadgeCounts(cached, manual);
		});
	});

	describe("Edge Cases", () => {
		it("should never go negative", () => {
			const queue = [createCardWithState("new1", State.New)];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 0 });

			stateManager.nextCard();
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 0 });

			// Try to advance again (no more cards)
			stateManager.nextCard();

			// Should still be zeros, not negative
			const counts = stateManager.getBadgeCounts();
			expect(counts.new).toBeGreaterThanOrEqual(0);
			expect(counts.learning).toBeGreaterThanOrEqual(0);
			expect(counts.due).toBeGreaterThanOrEqual(0);
		});

		it("should handle all cards of same type", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("new2", State.New),
				createCardWithState("new3", State.New),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 3, learning: 0, due: 0 });

			stateManager.nextCard();
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 2, learning: 0, due: 0 });

			stateManager.nextCard();
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 0, due: 0 });

			stateManager.nextCard();
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 0 });
		});

		it("should handle requeue at end of queue", () => {
			const queue = [
				createCardWithState("learning1", State.Learning),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 1, due: 0 });

			// Answer and requeue at end
			const updatedCard = createCardWithState("learning1", State.Learning);
			const requeuedCard = createCardWithState("learning1-again", State.Learning);

			stateManager.recordAnswerAndNext(Rating.Again, updatedCard, {
				card: requeuedCard,
				position: 1, // At end
			});

			// The requeued card is now the remaining card
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 1, due: 0 });
		});

		it("should handle batch removal of multiple cards", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("review1", State.Review),
				createCardWithState("review2", State.Review),
				createCardWithState("new2", State.New),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 2, learning: 0, due: 2 });

			// Remove all review cards
			stateManager.removeCardsByIds(["review1", "review2"]);

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 2, learning: 0, due: 0 });
		});

		it("should handle requeue at specific position", () => {
			const queue = [
				createCardWithState("learning1", State.Learning),
				createCardWithState("new1", State.New),
				createCardWithState("review1", State.Review),
			];

			stateManager.startSession(queue);
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 1, due: 1 });

			// Requeue learning card at position 2 (before review1)
			const requeuedCard = createCardWithState("learning1-again", State.Learning);
			stateManager.requeueCard(requeuedCard, 2);

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 1, learning: 2, due: 1 });
		});

		it("should not count requeue if inserted before current index", () => {
			const queue = [
				createCardWithState("new1", State.New),
				createCardWithState("review1", State.Review),
			];

			stateManager.startSession(queue);
			stateManager.nextCard(); // At index 1 now

			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 1 });

			// Requeue at position 0 (before current index)
			const requeuedCard = createCardWithState("learning1", State.Learning);
			stateManager.requeueCard(requeuedCard, 0);

			// Since inserted before current index, shouldn't affect remaining counts
			expectBadgeCounts(stateManager.getBadgeCounts(), { new: 0, learning: 0, due: 1 });
		});
	});
});
