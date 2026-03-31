/**
 * Card Lifecycle Tests
 * Behavior-first tests for card CRUD operations
 *
 * These tests define expected behavior for data integrity.
 * Code may need to be modified to pass these tests.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { State } from "ts-fsrs";
import {
	createTestContext,
	createTestCard,
	createCardWithSource,
	getRawCard,
	type TestContext,
} from "./__setup__/test-database";

describe("Card Lifecycle", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
	});

	describe("Card Creation", () => {
		it("should create card with provided UUID", async () => {
			const card = createTestCard({ id: "test-uuid-123" });

			ctx.cards.set(card.id, card);
			const retrieved = ctx.cards.get("test-uuid-123");

			expect(retrieved).not.toBeNull();
			expect(retrieved?.id).toBe("test-uuid-123");
		});

		it("should set createdAt on new card", async () => {
			const now = Date.now();
			const card = createTestCard({ createdAt: now });

			ctx.cards.set(card.id, card);
			const raw = getRawCard(ctx.db, card.id);

			expect(raw?.created_at).toBe(now);
		});

		it("should set updatedAt on new card", async () => {
			const before = Date.now();
			const card = createTestCard();

			ctx.cards.set(card.id, card);
			const after = Date.now();

			const raw = getRawCard(ctx.db, card.id);
			expect(raw?.updated_at).toBeGreaterThanOrEqual(before);
			expect(raw?.updated_at).toBeLessThanOrEqual(after);
		});

		it("should store question and answer content correctly", async () => {
			const question = "What is **markdown** with `code` and special chars: <>&\"'?";
			const answer = "Content with:\n- newlines\n- unicode: 日本語 🎉\n- tabs:\t\there";

			const card = createTestCard({ question, answer });
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.question).toBe(question);
			expect(retrieved?.answer).toBe(answer);
		});

		it("should link card to source note via sourceUid", async () => {
			const sourceUid = "abc12345";
			const card = createCardWithSource(sourceUid);

			ctx.cards.set(card.id, card);

			const cardsBySource = ctx.cards.getCardsBySourceUid(sourceUid);
			expect(cardsBySource).toHaveLength(1);
			expect(cardsBySource[0]?.id).toBe(card.id);
		});

		it("should allow card without sourceUid (orphaned)", async () => {
			const card = createTestCard({ sourceUid: undefined });

			ctx.cards.set(card.id, card);
			const retrieved = ctx.cards.get(card.id);

			expect(retrieved).not.toBeNull();
			expect(retrieved?.sourceUid).toBeUndefined();
		});

		it("should store FSRS scheduling data correctly", async () => {
			const card = createTestCard({
				state: State.Review,
				stability: 14.5,
				difficulty: 5.2,
				reps: 10,
				lapses: 2,
				scheduledDays: 7,
				learningStep: 0,
			});

			ctx.cards.set(card.id, card);
			const retrieved = ctx.cards.get(card.id);

			expect(retrieved?.state).toBe(State.Review);
			expect(retrieved?.stability).toBe(14.5);
			expect(retrieved?.difficulty).toBe(5.2);
			expect(retrieved?.reps).toBe(10);
			expect(retrieved?.lapses).toBe(2);
			expect(retrieved?.scheduledDays).toBe(7);
		});
	});

	describe("Card Updates", () => {
		it("should preserve createdAt on update (only updatedAt changes)", async () => {
			const originalCreatedAt = Date.now() - 3600000; // 1 hour ago
			const card = createTestCard({ createdAt: originalCreatedAt });
			ctx.cards.set(card.id, card);

			// Wait a bit to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Update the card
			const updatedCard = { ...card, question: "Updated question" };
			ctx.cards.set(card.id, updatedCard);

			const raw = getRawCard(ctx.db, card.id);
			expect(raw?.created_at).toBe(originalCreatedAt);
			expect(raw?.updated_at).toBeGreaterThan(originalCreatedAt);
		});

		it("should update content without losing FSRS data", async () => {
			const card = createTestCard({
				state: State.Review,
				stability: 14.5,
				difficulty: 5.2,
				reps: 10,
			});
			ctx.cards.set(card.id, card);

			// Update only content
			ctx.cards.updateCardContent(card.id, "New question", "New answer");

			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.question).toBe("New question");
			expect(retrieved?.answer).toBe("New answer");
			// FSRS data should be preserved
			expect(retrieved?.state).toBe(State.Review);
			expect(retrieved?.stability).toBe(14.5);
			expect(retrieved?.difficulty).toBe(5.2);
			expect(retrieved?.reps).toBe(10);
		});

		it("should update FSRS data without losing content", async () => {
			const card = createTestCard({
				question: "Original Q",
				answer: "Original A",
				state: State.New,
			});
			ctx.cards.set(card.id, card);

			// Update FSRS data by setting full card with updated scheduling
			const updatedCard = {
				...card,
				state: State.Review,
				stability: 7,
				reps: 5,
			};
			ctx.cards.set(card.id, updatedCard);

			const retrieved = ctx.cards.get(card.id);
			// Content should be preserved
			expect(retrieved?.question).toBe("Original Q");
			expect(retrieved?.answer).toBe("Original A");
			// FSRS should be updated
			expect(retrieved?.state).toBe(State.Review);
			expect(retrieved?.stability).toBe(7);
			expect(retrieved?.reps).toBe(5);
		});

		it("should atomically update source_uid", async () => {
			const oldSourceUid = "old12345";
			const newSourceUid = "new67890";

			const card = createCardWithSource(oldSourceUid);
			ctx.cards.set(card.id, card);

			// Update source_uid
			ctx.cards.updateCardSourceUid(card.id, newSourceUid);

			// Card should now be linked to new source
			const newSourceCards = ctx.cards.getCardsBySourceUid(newSourceUid);
			expect(newSourceCards).toHaveLength(1);
			expect(newSourceCards[0]?.id).toBe(card.id);

			// Old source should have no cards
			const oldSourceCards = ctx.cards.getCardsBySourceUid(oldSourceUid);
			expect(oldSourceCards).toHaveLength(0);
		});
	});

	describe("Soft Delete", () => {
		it("should set deleted_at timestamp on soft delete", async () => {
			const card = createTestCard();
			ctx.cards.set(card.id, card);

			const before = Date.now();
			ctx.cards.softDelete(card.id);
			const after = Date.now();

			const raw = getRawCard(ctx.db, card.id);
			expect(raw?.deleted_at).toBeGreaterThanOrEqual(before);
			expect(raw?.deleted_at).toBeLessThanOrEqual(after);
		});

		it("should exclude soft-deleted cards from getAll()", async () => {
			const card1 = createTestCard({ id: "card-1" });
			const card2 = createTestCard({ id: "card-2" });
			const card3 = createTestCard({ id: "card-3" });

			ctx.cards.set(card1.id, card1);
			ctx.cards.set(card2.id, card2);
			ctx.cards.set(card3.id, card3);

			// Delete one card
			ctx.cards.softDelete(card2.id);

			const allCards = ctx.cards.getAll();
			expect(allCards).toHaveLength(2);
			expect(allCards.map((c) => c.id)).toContain("card-1");
			expect(allCards.map((c) => c.id)).toContain("card-3");
			expect(allCards.map((c) => c.id)).not.toContain("card-2");
		});

		it("should exclude soft-deleted cards from has()", async () => {
			const card = createTestCard();
			ctx.cards.set(card.id, card);

			expect(ctx.cards.has(card.id)).toBe(true);

			ctx.cards.softDelete(card.id);

			expect(ctx.cards.has(card.id)).toBe(false);
		});

		it("should exclude soft-deleted cards from get()", async () => {
			const card = createTestCard();
			ctx.cards.set(card.id, card);

			expect(ctx.cards.get(card.id)).not.toBeNull();

			ctx.cards.softDelete(card.id);

			expect(ctx.cards.get(card.id)).toBeUndefined();
		});

		it("should cascade soft delete to review_log", async () => {
			const card = createTestCard();
			ctx.cards.set(card.id, card);

			// Add some review log entries
			const reviewId1 = "review-1";
			const reviewId2 = "review-2";
			ctx.db.run(
				`INSERT INTO review_log (id, card_id, reviewed_at, rating) VALUES (?, ?, ?, ?)`,
				[reviewId1, card.id, new Date().toISOString(), 3]
			);
			ctx.db.run(
				`INSERT INTO review_log (id, card_id, reviewed_at, rating) VALUES (?, ?, ?, ?)`,
				[reviewId2, card.id, new Date().toISOString(), 4]
			);

			// Soft delete with cascade
			ctx.cards.softDeleteWithCascade(card.id);

			// Check review logs are also soft deleted
			const logs = ctx.db.query<{ id: string; deleted_at: number | null }>(
				`SELECT id, deleted_at FROM review_log WHERE card_id = ?`,
				[card.id]
			);

			expect(logs).toHaveLength(2);
			expect(logs[0]?.deleted_at).not.toBeNull();
			expect(logs[1]?.deleted_at).not.toBeNull();
		});

		it("should update updated_at when soft deleting", async () => {
			const card = createTestCard();
			ctx.cards.set(card.id, card);

			const beforeDelete = getRawCard(ctx.db, card.id)?.updated_at as number;

			// Wait to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 10));

			ctx.cards.softDelete(card.id);

			const afterDelete = getRawCard(ctx.db, card.id)?.updated_at as number;
			expect(afterDelete).toBeGreaterThan(beforeDelete);
		});
	});

	describe("Query Operations", () => {
		it("should return correct count with size()", async () => {
			expect(ctx.cards.size()).toBe(0);

			ctx.cards.set("card-1", createTestCard({ id: "card-1" }));
			expect(ctx.cards.size()).toBe(1);

			ctx.cards.set("card-2", createTestCard({ id: "card-2" }));
			expect(ctx.cards.size()).toBe(2);

			ctx.cards.softDelete("card-1");
			expect(ctx.cards.size()).toBe(1);
		});

		it("should return card IDs with keys()", async () => {
			ctx.cards.set("card-a", createTestCard({ id: "card-a" }));
			ctx.cards.set("card-b", createTestCard({ id: "card-b" }));
			ctx.cards.set("card-c", createTestCard({ id: "card-c" }));

			ctx.cards.softDelete("card-b");

			const keys = ctx.cards.keys();
			expect(keys).toHaveLength(2);
			expect(keys).toContain("card-a");
			expect(keys).toContain("card-c");
			expect(keys).not.toContain("card-b");
		});

		it("should batch fetch cards by IDs with getByIds()", async () => {
			ctx.cards.set("card-1", createTestCard({ id: "card-1" }));
			ctx.cards.set("card-2", createTestCard({ id: "card-2" }));
			ctx.cards.set("card-3", createTestCard({ id: "card-3" }));

			const fetched = ctx.cards.getByIds(["card-1", "card-3"]);
			expect(fetched).toHaveLength(2);
			expect(fetched.map((c) => c.id)).toContain("card-1");
			expect(fetched.map((c) => c.id)).toContain("card-3");
		});

		it("should return empty array for getByIds with empty input", async () => {
			const fetched = ctx.cards.getByIds([]);
			expect(fetched).toHaveLength(0);
		});

		it("should exclude deleted cards from getByIds()", async () => {
			ctx.cards.set("card-1", createTestCard({ id: "card-1" }));
			ctx.cards.set("card-2", createTestCard({ id: "card-2" }));

			ctx.cards.softDelete("card-2");

			const fetched = ctx.cards.getByIds(["card-1", "card-2"]);
			expect(fetched).toHaveLength(1);
			expect(fetched[0]?.id).toBe("card-1");
		});
	});

	describe("Source UID Operations", () => {
		it("should find multiple cards by source UID", async () => {
			const sourceUid = "source123";
			ctx.cards.set("card-1", createCardWithSource(sourceUid, { id: "card-1" }));
			ctx.cards.set("card-2", createCardWithSource(sourceUid, { id: "card-2" }));
			ctx.cards.set("card-3", createCardWithSource("other456", { id: "card-3" }));

			const cards = ctx.cards.getCardsBySourceUid(sourceUid);
			expect(cards).toHaveLength(2);
			expect(cards.map((c) => c.id)).toContain("card-1");
			expect(cards.map((c) => c.id)).toContain("card-2");
		});

		it("should order cards by created_at when fetching by source UID", async () => {
			const sourceUid = "source123";
			const now = Date.now();

			// Create cards in specific order
			ctx.cards.set(
				"card-b",
				createCardWithSource(sourceUid, {
					id: "card-b",
					createdAt: now + 1000,
				})
			);
			ctx.cards.set(
				"card-a",
				createCardWithSource(sourceUid, {
					id: "card-a",
					createdAt: now,
				})
			);
			ctx.cards.set(
				"card-c",
				createCardWithSource(sourceUid, {
					id: "card-c",
					createdAt: now + 2000,
				})
			);

			const cards = ctx.cards.getCardsBySourceUid(sourceUid);
			expect(cards.map((c) => c.id)).toEqual(["card-a", "card-b", "card-c"]);
		});

		it("should exclude deleted cards when fetching by source UID", async () => {
			const sourceUid = "source123";
			ctx.cards.set("card-1", createCardWithSource(sourceUid, { id: "card-1" }));
			ctx.cards.set("card-2", createCardWithSource(sourceUid, { id: "card-2" }));

			ctx.cards.softDelete("card-1");

			const cards = ctx.cards.getCardsBySourceUid(sourceUid);
			expect(cards).toHaveLength(1);
			expect(cards[0]?.id).toBe("card-2");
		});
	});
});
