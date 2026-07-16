import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	advanceAfterAnswer,
	countBadges,
	insertAt,
	isCardDueNow,
	isPendingLearning,
	promoteActionableCard,
	removeAt,
	removeByIds,
} from "../../src/features/study/store/review-queue.engine";
import { createMockCard, createMockCardWithState } from "./test-helpers";

const NOW = new Date("2024-01-15T10:00:00Z");

describe("review-queue.engine", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("isCardDueNow", () => {
		it("should require exact due time for learning cards", () => {
			expect(
				isCardDueNow(createMockCardWithState(State.Learning, 5), NOW),
			).toBe(false);
			expect(
				isCardDueNow(createMockCardWithState(State.Learning, -1), NOW),
			).toBe(true);
		});

		it("should apply the learn-ahead window to non-learning cards", () => {
			expect(isCardDueNow(createMockCardWithState(State.Review, 15), NOW)).toBe(
				true,
			);
			expect(isCardDueNow(createMockCardWithState(State.Review, 25), NOW)).toBe(
				false,
			);
		});
	});

	describe("isPendingLearning", () => {
		it("should be true only for not-yet-due learning/relearning cards", () => {
			expect(
				isPendingLearning(createMockCardWithState(State.Learning, 5), NOW),
			).toBe(true);
			expect(
				isPendingLearning(createMockCardWithState(State.Relearning, 5), NOW),
			).toBe(true);
			expect(
				isPendingLearning(createMockCardWithState(State.Learning, -1), NOW),
			).toBe(false);
			expect(
				isPendingLearning(createMockCardWithState(State.Review, 60), NOW),
			).toBe(false);
		});
	});

	describe("countBadges", () => {
		it("should count states from the given index", () => {
			const queue = [
				createMockCardWithState(State.New),
				createMockCardWithState(State.Learning),
				createMockCardWithState(State.Review),
			];
			expect(countBadges(queue, 0)).toEqual({ new: 1, learning: 1, due: 1 });
			expect(countBadges(queue, 1)).toEqual({ new: 0, learning: 1, due: 1 });
			expect(countBadges(queue, 3)).toEqual({ new: 0, learning: 0, due: 0 });
		});
	});

	describe("promoteActionableCard", () => {
		it("should swap a pending learning cursor card with the first actionable card", () => {
			const pending = createMockCardWithState(State.Learning, 5);
			const alsoPending = createMockCardWithState(State.Relearning, 8);
			const actionable = createMockCardWithState(State.New);

			const result = promoteActionableCard(
				{ queue: [pending, alsoPending, actionable], currentIndex: 0 },
				NOW,
			);

			expect(result.swappedWith).toBe(2);
			expect(result.queue[0]?.id).toBe(actionable.id);
			expect(result.queue[2]?.id).toBe(pending.id);
			expect(result.currentIndex).toBe(0);
		});

		it("should not touch the queue when the cursor card is actionable", () => {
			const snapshot = {
				queue: [
					createMockCardWithState(State.Review),
					createMockCardWithState(State.Learning, 5),
				],
				currentIndex: 0,
			};

			const result = promoteActionableCard(snapshot, NOW);

			expect(result.swappedWith).toBeNull();
			expect(result.queue).toBe(snapshot.queue);
		});

		it("should leave the cursor in place when only pending cards remain", () => {
			const result = promoteActionableCard(
				{
					queue: [
						createMockCardWithState(State.Learning, 5),
						createMockCardWithState(State.Learning, 10),
					],
					currentIndex: 0,
				},
				NOW,
			);

			expect(result.swappedWith).toBeNull();
		});

		it("should handle a cursor past the end of the queue", () => {
			const result = promoteActionableCard(
				{ queue: [createMockCard()], currentIndex: 1 },
				NOW,
			);

			expect(result.swappedWith).toBeNull();
			expect(result.currentIndex).toBe(1);
		});
	});

	describe("removeAt", () => {
		it("should shift the cursor left when removing before it", () => {
			const queue = [createMockCard(), createMockCard(), createMockCard()];
			const result = removeAt({ queue, currentIndex: 2 }, 0, NOW);

			expect(result.queue).toHaveLength(2);
			expect(result.currentIndex).toBe(1);
		});

		it("should let the cursor reach queue.length when removing the last card", () => {
			const queue = [createMockCard(), createMockCard()];
			const result = removeAt({ queue, currentIndex: 1 }, 1, NOW);

			expect(result.queue).toHaveLength(1);
			expect(result.currentIndex).toBe(1);
		});

		it("should promote an actionable card after removal", () => {
			const current = createMockCardWithState(State.Review);
			const pending = createMockCardWithState(State.Learning, 5);
			const actionable = createMockCardWithState(State.New);

			const result = removeAt(
				{ queue: [current, pending, actionable], currentIndex: 0 },
				0,
				NOW,
			);

			expect(result.queue[0]?.id).toBe(actionable.id);
		});

		it("should return the snapshot unchanged for an out-of-range index", () => {
			const snapshot = { queue: [createMockCard()], currentIndex: 0 };
			expect(removeAt(snapshot, 5, NOW)).toBe(snapshot);
		});
	});

	describe("removeByIds", () => {
		it("should remove every occurrence of an id", () => {
			const again = createMockCard({ id: "again" });
			const other = createMockCard({ id: "other" });
			const result = removeByIds(
				{ queue: [again, other, again], currentIndex: 1 },
				["again"],
				NOW,
			);

			expect(result.queue.map((c) => c.id)).toEqual(["other"]);
			expect(result.currentIndex).toBe(0);
		});

		it("should let the cursor reach queue.length when trailing cards are removed", () => {
			const done = createMockCard({ id: "done" });
			const last = createMockCard({ id: "last" });
			const result = removeByIds(
				{ queue: [done, last], currentIndex: 1 },
				["last"],
				NOW,
			);

			expect(result.currentIndex).toBe(1);
			expect(result.queue).toHaveLength(1);
		});

		it("should promote an actionable card after removal", () => {
			const current = createMockCardWithState(State.Review);
			const pending = createMockCardWithState(State.Learning, 5);
			const actionable = createMockCardWithState(State.Review);

			const result = removeByIds(
				{ queue: [current, pending, actionable], currentIndex: 0 },
				[current.id],
				NOW,
			);

			expect(result.queue[0]?.id).toBe(actionable.id);
		});
	});

	describe("insertAt", () => {
		it("should shift the cursor when inserting strictly before it", () => {
			const queue = [createMockCard(), createMockCard()];
			const inserted = createMockCard({ id: "inserted" });

			const result = insertAt({ queue, currentIndex: 1 }, inserted, 0);

			expect(result.currentIndex).toBe(2);
			expect(result.queue[0]?.id).toBe("inserted");
		});

		it("should put the card under the cursor when inserting at it", () => {
			const queue = [createMockCard(), createMockCard()];
			const inserted = createMockCard({ id: "inserted" });

			const result = insertAt({ queue, currentIndex: 1 }, inserted, 1);

			expect(result.currentIndex).toBe(1);
			expect(result.queue[1]?.id).toBe("inserted");
		});

		it("should clamp out-of-range positions", () => {
			const queue = [createMockCard()];
			const inserted = createMockCard({ id: "inserted" });

			const result = insertAt({ queue, currentIndex: 0 }, inserted, 99);

			expect(result.queue[1]?.id).toBe("inserted");
		});
	});

	describe("advanceAfterAnswer", () => {
		it("should replace the cursor card and advance", () => {
			const card = createMockCardWithState(State.Review);
			const next = createMockCardWithState(State.Review);
			const updated = { ...card, fsrs: { ...card.fsrs, reps: 2 } };

			const result = advanceAfterAnswer(
				{ queue: [card, next], currentIndex: 0 },
				updated,
				undefined,
				NOW,
			);

			expect(result.queue[0]?.fsrs.reps).toBe(2);
			expect(result.currentIndex).toBe(1);
			expect(result.requeuePosition).toBeUndefined();
		});

		it("should splice the requeued copy at its position", () => {
			const card = createMockCardWithState(State.Review);
			const next = createMockCardWithState(State.Review);
			const requeued = createMockCardWithState(State.Relearning, -1); // already due

			const result = advanceAfterAnswer(
				{ queue: [card, next], currentIndex: 0 },
				card,
				{ card: requeued, position: 1 },
				NOW,
			);

			expect(result.queue[1]?.id).toBe(requeued.id);
			expect(result.requeuePosition).toBe(1);
		});

		it("should report where a pending requeued copy landed after promotion", () => {
			const card = createMockCardWithState(State.Review);
			const next = createMockCardWithState(State.Review);
			const pendingRequeued = createMockCardWithState(State.Relearning, 5);

			const result = advanceAfterAnswer(
				{ queue: [card, next], currentIndex: 0 },
				card,
				{ card: pendingRequeued, position: 1 },
				NOW,
			);

			// Pending copy swapped away from the cursor with the actionable card.
			expect(result.queue[1]?.id).toBe(next.id);
			expect(result.queue[2]?.id).toBe(pendingRequeued.id);
			expect(result.requeuePosition).toBe(2);
		});
	});
});
