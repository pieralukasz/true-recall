/**
 * Bulk Operations Tests
 * Behavior-first tests for card bulk operations
 */

import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FSRSCardData } from "../../../../src/types";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "./__setup__/test-database";

describe("Bulk Operations", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	describe("bulkSuspend", () => {
		it("should suspend multiple cards", async () => {
			const cards = [
				createTestCard({ id: "card-1", suspended: false }),
				createTestCard({ id: "card-2", suspended: false }),
				createTestCard({ id: "card-3", suspended: false }),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const affected = ctx.cards.bulkSuspend(["card-1", "card-2"]);

			expect(affected).toBe(2);

			const card1 = ctx.cards.get("card-1");
			const card2 = ctx.cards.get("card-2");
			const card3 = ctx.cards.get("card-3");

			expect(card1?.suspended).toBe(true);
			expect(card2?.suspended).toBe(true);
			expect(card3?.suspended).toBe(false); // Not in the list
		});

		it("should return affected count", async () => {
			const cards = [
				createTestCard({ id: "card-1" }),
				createTestCard({ id: "card-2" }),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const affected = ctx.cards.bulkSuspend(["card-1", "card-2"]);

			expect(affected).toBe(2);
		});

		it("should return 0 for empty array", async () => {
			const affected = ctx.cards.bulkSuspend([]);
			expect(affected).toBe(0);
		});

		it("should ignore non-existent IDs", async () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			const affected = ctx.cards.bulkSuspend(["card-1", "nonexistent"]);

			expect(affected).toBe(1); // Only card-1 exists
		});
	});

	describe("bulkUnsuspend", () => {
		it("should unsuspend multiple cards", async () => {
			const cards = [
				createTestCard({ id: "card-1", suspended: true }),
				createTestCard({ id: "card-2", suspended: true }),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const affected = ctx.cards.bulkUnsuspend(["card-1", "card-2"]);

			expect(affected).toBe(2);

			const card1 = ctx.cards.get("card-1");
			const card2 = ctx.cards.get("card-2");

			expect(card1?.suspended).toBe(false);
			expect(card2?.suspended).toBe(false);
		});

		it("should return 0 for empty array", async () => {
			const affected = ctx.cards.bulkUnsuspend([]);
			expect(affected).toBe(0);
		});
	});

	describe("bulkBury", () => {
		it("should bury cards until specified date", async () => {
			const cards = [
				createTestCard({ id: "card-1" }),
				createTestCard({ id: "card-2" }),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const untilDate = "2026-02-15T00:00:00Z";
			const affected = ctx.cards.bulkBury(["card-1", "card-2"], untilDate);

			expect(affected).toBe(2);

			const card1 = ctx.cards.get("card-1");
			const card2 = ctx.cards.get("card-2");

			expect(card1?.buriedUntil).toBe(untilDate);
			expect(card2?.buriedUntil).toBe(untilDate);
		});

		it("should return 0 for empty array", async () => {
			const affected = ctx.cards.bulkBury([], "2026-02-15");
			expect(affected).toBe(0);
		});
	});

	describe("bulkUnbury", () => {
		it("should unbury cards by clearing buriedUntil", async () => {
			const cards = [
				createTestCard({ id: "card-1", buriedUntil: "2026-02-15T00:00:00Z" }),
				createTestCard({ id: "card-2", buriedUntil: "2026-02-20T00:00:00Z" }),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const affected = ctx.cards.bulkUnbury(["card-1", "card-2"]);

			expect(affected).toBe(2);

			const card1 = ctx.cards.get("card-1");
			const card2 = ctx.cards.get("card-2");

			expect(card1?.buriedUntil).toBeUndefined();
			expect(card2?.buriedUntil).toBeUndefined();
		});

		it("should return 0 for empty array", async () => {
			const affected = ctx.cards.bulkUnbury([]);
			expect(affected).toBe(0);
		});
	});

	describe("bulkSoftDelete", () => {
		it("should soft delete multiple cards", async () => {
			const cards = [
				createTestCard({ id: "card-1" }),
				createTestCard({ id: "card-2" }),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			expect(ctx.cards.size()).toBe(2);

			const affected = ctx.cards.bulkSoftDelete(["card-1", "card-2"]);

			expect(affected).toBe(2);
			expect(ctx.cards.size()).toBe(0); // Soft deleted, not visible

			// But still in getAllIncludingDeleted
			const all = ctx.cards.getAllIncludingDeleted();
			expect(all).toHaveLength(2);
		});

		it("should cascade soft delete to review_log", async () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);
			ctx.stats.addReviewLog("card-1", 3, 7, 0, State.Review, 5000);

			expect(ctx.stats.getTotalReviewCount()).toBe(1);

			ctx.cards.bulkSoftDelete(["card-1"]);

			// Review log should also be soft deleted
			expect(ctx.stats.getTotalReviewCount()).toBe(0);
		});

		it("should return 0 for empty array", async () => {
			const affected = ctx.cards.bulkSoftDelete([]);
			expect(affected).toBe(0);
		});
	});

	describe("bulkReset", () => {
		it("should reset cards to New state", async () => {
			const cards = [
				createTestCard({
					id: "card-1",
					state: State.Review,
					reps: 10,
					lapses: 2,
					stability: 15,
					difficulty: 7,
					scheduledDays: 14,
				}),
				createTestCard({
					id: "card-2",
					state: State.Learning,
					reps: 3,
				}),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const affected = ctx.cards.bulkReset(["card-1", "card-2"]);

			expect(affected).toBe(2);

			const card1 = ctx.cards.get("card-1");
			const card2 = ctx.cards.get("card-2");

			// Card 1 should be reset
			expect(card1?.state).toBe(State.New);
			expect(card1?.reps).toBe(0);
			expect(card1?.lapses).toBe(0);
			expect(card1?.stability).toBe(0);
			expect(card1?.difficulty).toBe(0);
			expect(card1?.scheduledDays).toBe(0);
			expect(card1?.learningStep).toBe(0);
			expect(card1?.lastReview).toBeNull();
			expect(card1?.suspended).toBe(false);
			expect(card1?.buriedUntil).toBeUndefined();

			// Card 2 should be reset
			expect(card2?.state).toBe(State.New);
			expect(card2?.reps).toBe(0);
		});

		it("should return 0 for empty array", async () => {
			const affected = ctx.cards.bulkReset([]);
			expect(affected).toBe(0);
		});
	});

	describe("bulkReschedule", () => {
		it("should reschedule cards to specific date", async () => {
			const cards = [
				createTestCard({ id: "card-1", due: "2026-02-01T10:00:00Z" }),
				createTestCard({ id: "card-2", due: "2026-02-05T10:00:00Z" }),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const newDue = "2026-03-01T00:00:00Z";
			const affected = ctx.cards.bulkReschedule(["card-1", "card-2"], newDue);

			expect(affected).toBe(2);

			const card1 = ctx.cards.get("card-1");
			const card2 = ctx.cards.get("card-2");

			expect(card1?.due).toBe(newDue);
			expect(card2?.due).toBe(newDue);
		});

		it("should return 0 for empty array", async () => {
			const affected = ctx.cards.bulkReschedule([], "2026-03-01");
			expect(affected).toBe(0);
		});
	});

	describe("Edge Cases", () => {
		it("should handle large batch operations", async () => {
			// Create 100 cards
			const cards: FSRSCardData[] = [];
			for (let i = 0; i < 100; i++) {
				cards.push(createTestCard({ id: `card-${i}` }));
			}
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const cardIds = cards.map((c) => c.id);
			const affected = ctx.cards.bulkSuspend(cardIds);

			expect(affected).toBe(100);
		});

		it("should update timestamps on bulk operations", async () => {
			const card = createTestCard({ id: "card-timestamp" });
			ctx.cards.set(card.id, card);

			const initialUpdatedAt = ctx.cards.getModifiedSince(0)[0]?.updatedAt;

			vi.advanceTimersByTime(5000);

			ctx.cards.bulkSuspend(["card-timestamp"]);

			const afterCard = ctx.cards.getModifiedSince(0)[0];
			expect(afterCard?.updatedAt).toBeGreaterThan(initialUpdatedAt!);
		});

		it("should handle mixed existing and non-existing IDs", async () => {
			const cards = [
				createTestCard({ id: "exists-1" }),
				createTestCard({ id: "exists-2" }),
			];
			cards.forEach((c) => ctx.cards.set(c.id, c));

			const affected = ctx.cards.bulkSuspend([
				"exists-1",
				"nonexistent-1",
				"exists-2",
				"nonexistent-2",
			]);

			// Only existing cards are affected
			expect(affected).toBe(2);
		});
	});
});
