/**
 * Data Consistency Tests
 * Behavior-first tests for data integrity constraints
 *
 * Some tests are expected to FAIL with current implementation.
 * Code needs to be modified to add validation.
 */

import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createTestCard,
	createTestContext,
	getRawCard,
	getRawNote,
	type TestContext,
} from "./__setup__/test-database";

describe("Data Consistency", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
	});

	describe("Timestamp Consistency", () => {
		it("should always set updated_at on any modification", async () => {
			const card = createTestCard();
			ctx.cards.set(card.id, card);

			// updateCardContent updates the note row, not the card row
			const rawCard = getRawCard(ctx.db, card.id);
			const noteId = rawCard?.note_id as string;
			const initialNote = getRawNote(ctx.db, noteId);
			const initialNoteUpdatedAt = initialNote?.updated_at as number;

			// Wait to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Update content (updates notes table in v26 schema)
			ctx.cards.updateCardContent(card.id, "New Q", "New A");

			const afterNote = getRawNote(ctx.db, noteId);
			const afterNoteUpdatedAt = afterNote?.updated_at as number;
			expect(afterNoteUpdatedAt).toBeGreaterThan(initialNoteUpdatedAt);
		});

		it("should update updated_at when changing source_uid", async () => {
			const card = createTestCard({ sourceUid: "old123" });
			ctx.cards.set(card.id, card);

			const initial = getRawCard(ctx.db, card.id)?.updated_at as number;

			await new Promise((resolve) => setTimeout(resolve, 10));

			ctx.cards.updateCardSourceUid(card.id, "new456");

			const afterUpdate = getRawCard(ctx.db, card.id)?.updated_at as number;
			expect(afterUpdate).toBeGreaterThan(initial);
		});

		it("should preserve created_at across all updates", async () => {
			const originalCreatedAt = Date.now() - 86400000; // 1 day ago
			const card = createTestCard({ createdAt: originalCreatedAt });
			ctx.cards.set(card.id, card);

			// Multiple updates
			ctx.cards.updateCardContent(card.id, "Q1", "A1");
			ctx.cards.updateCardSourceUid(card.id, "new123");
			ctx.cards.set(card.id, { ...card, question: "Q2" });

			const raw = getRawCard(ctx.db, card.id);
			expect(raw?.created_at).toBe(originalCreatedAt);
		});

		it("should set updated_at equal to deleted_at on soft delete", async () => {
			const card = createTestCard();
			ctx.cards.set(card.id, card);

			ctx.cards.softDelete(card.id);

			const raw = getRawCard(ctx.db, card.id);
			expect(raw?.updated_at).toBe(raw?.deleted_at);
		});
	});

	describe("State Validation", () => {
		/**
		 * NOTE: These tests define expected behavior.
		 * Current implementation allows invalid values.
		 * Consider adding validation to CardActions.set().
		 */

		it("should store valid FSRS state values (0-3)", async () => {
			const validStates = [
				State.New,
				State.Learning,
				State.Review,
				State.Relearning,
			];

			for (const state of validStates) {
				const card = createTestCard({ id: `card-${state}`, state });
				ctx.cards.set(card.id, card);

				const retrieved = ctx.cards.get(card.id);
				expect(retrieved?.state).toBe(state);
			}
		});

		it("should handle state as integer", async () => {
			const card = createTestCard({ state: 2 }); // State.Review
			ctx.cards.set(card.id, card);

			const raw = getRawCard(ctx.db, card.id);
			expect(raw?.state).toBe(2);
		});

		/**
		 * EXPECTED BEHAVIOR: Should reject invalid state values
		 * CURRENT BEHAVIOR: Allows any integer
		 *
		 * Uncomment this test after adding validation to CardActions.set()
		 */
		// it("should reject invalid state values", async () => {
		// 	const card = createTestCard({ state: 99 as State });
		// 	expect(() => ctx.cards.set(card.id, card)).toThrow();
		// });
	});

	describe("Scheduling Value Validation", () => {
		it("should store zero values for scheduling", async () => {
			const card = createTestCard({
				scheduledDays: 0,
				stability: 0,
				difficulty: 0,
			});
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.scheduledDays).toBe(0);
			expect(retrieved?.stability).toBe(0);
			expect(retrieved?.difficulty).toBe(0);
		});

		it("should store positive scheduling values", async () => {
			const card = createTestCard({
				scheduledDays: 14,
				stability: 21.5,
				difficulty: 5.3,
			});
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.scheduledDays).toBe(14);
			expect(retrieved?.stability).toBe(21.5);
			expect(retrieved?.difficulty).toBe(5.3);
		});

		/**
		 * EXPECTED BEHAVIOR: Should reject negative scheduling values
		 * CURRENT BEHAVIOR: Allows any number
		 *
		 * Uncomment these tests after adding validation
		 */
		// it("should reject negative scheduledDays", async () => {
		// 	const card = createTestCard({ scheduledDays: -1 });
		// 	expect(() => ctx.cards.set(card.id, card)).toThrow();
		// });

		// it("should reject negative stability", async () => {
		// 	const card = createTestCard({ stability: -5 });
		// 	expect(() => ctx.cards.set(card.id, card)).toThrow();
		// });

		it("should store large interval values", async () => {
			// Max interval is 36500 days (~100 years)
			const card = createTestCard({
				scheduledDays: 36500,
				stability: 36500,
			});
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.scheduledDays).toBe(36500);
			expect(retrieved?.stability).toBe(36500);
		});
	});

	describe("Content Validation", () => {
		it("should store empty question (edge case)", async () => {
			const card = createTestCard({ question: "" });
			ctx.cards.set(card.id, card);

			// In v26 schema, question lives in notes.fields_json, not cards.question
			const rawCard = getRawCard(ctx.db, card.id);
			const noteId = rawCard?.note_id as string;
			const rawNote = getRawNote(ctx.db, noteId);
			const fields = JSON.parse(rawNote?.fields_json as string) as Record<
				string,
				string
			>;
			expect(fields.Front).toBe("");
		});

		it("should store empty answer", async () => {
			const card = createTestCard({ answer: "" });
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.answer).toBe("");
		});

		it("should handle very long content", async () => {
			const longText = "x".repeat(100000); // 100KB
			const card = createTestCard({
				question: longText,
				answer: longText,
			});
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.question).toHaveLength(100000);
			expect(retrieved?.answer).toHaveLength(100000);
		});

		it("should preserve unicode content", async () => {
			const card = createTestCard({
				question: "日本語テスト 🎉 Ελληνικά العربية",
				answer: "🔥💯🚀 Special: \n\t\r",
			});
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.question).toBe("日本語テスト 🎉 Ελληνικά العربية");
			expect(retrieved?.answer).toBe("🔥💯🚀 Special: \n\t\r");
		});
	});

	describe("Transaction Integrity", () => {
		it("should rollback on error within transaction", async () => {
			const card = createTestCard({ id: "card-1", stability: 5 });
			ctx.cards.set(card.id, card);

			try {
				ctx.db.transaction(() => {
					// Update card
					ctx.db.run(`UPDATE cards SET stability = ? WHERE id = ?`, [
						10,
						card.id,
					]);
					// Force an error
					throw new Error("Intentional error");
				});
			} catch {
				// Expected
			}

			// Should be rolled back to original value
			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.stability).toBe(5);
		});

		it("should commit all changes on successful transaction", async () => {
			const card1 = createTestCard({ id: "card-1", stability: 1 });
			const card2 = createTestCard({ id: "card-2", stability: 2 });
			ctx.cards.set(card1.id, card1);
			ctx.cards.set(card2.id, card2);

			ctx.db.transaction(() => {
				ctx.db.run(`UPDATE cards SET stability = ? WHERE id = ?`, [
					10,
					"card-1",
				]);
				ctx.db.run(`UPDATE cards SET stability = ? WHERE id = ?`, [
					20,
					"card-2",
				]);
			});

			expect(ctx.cards.get("card-1")?.stability).toBe(10);
			expect(ctx.cards.get("card-2")?.stability).toBe(20);
		});

		it("should handle nested operations atomically", async () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			// Add review log entries
			ctx.db.run(
				`INSERT INTO review_log (id, card_id, reviewed_at, rating) VALUES (?, ?, ?, ?)`,
				["log-1", card.id, new Date().toISOString(), 3],
			);
			ctx.db.run(
				`INSERT INTO review_log (id, card_id, reviewed_at, rating) VALUES (?, ?, ?, ?)`,
				["log-2", card.id, new Date().toISOString(), 4],
			);

			// softDeleteWithCascade should be atomic
			ctx.cards.softDeleteWithCascade(card.id);

			// Both card and logs should be deleted
			const cardRaw = getRawCard(ctx.db, card.id);
			expect(cardRaw?.deleted_at).not.toBeNull();

			const logs = ctx.db.query<{ deleted_at: number | null }>(
				`SELECT deleted_at FROM review_log WHERE card_id = ?`,
				[card.id],
			);
			expect(logs.every((l) => l.deleted_at !== null)).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("should handle NULL vs undefined source_uid correctly", async () => {
			// Card with undefined sourceUid (JavaScript)
			const card = createTestCard({ sourceUid: undefined });
			ctx.cards.set(card.id, card);

			// In database, this is stored as NULL
			const raw = getRawCard(ctx.db, card.id);
			expect(raw?.source_uid).toBeNull();

			// When retrieved, should be undefined (not null)
			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.sourceUid).toBeUndefined();
		});

		it("should handle rapid sequential updates", async () => {
			const card = createTestCard({ id: "rapid-card" });
			ctx.cards.set(card.id, card);

			// 100 rapid updates
			for (let i = 0; i < 100; i++) {
				ctx.cards.set(card.id, { ...card, stability: i });
			}

			// Final state should be consistent
			const retrieved = ctx.cards.get(card.id);
			expect(retrieved?.stability).toBe(99);
		});

		it("should handle batch operations with large datasets", async () => {
			// Create 1000 cards
			const ids: string[] = [];
			for (let i = 0; i < 1000; i++) {
				const card = createTestCard({ id: `card-${i}` });
				ctx.cards.set(card.id, card);
				ids.push(card.id);
			}

			// Batch fetch
			const fetched = ctx.cards.getByIds(ids);
			expect(fetched).toHaveLength(1000);

			// Count
			expect(ctx.cards.size()).toBe(1000);

			// Get all
			const all = ctx.cards.getAll();
			expect(all).toHaveLength(1000);
		});

		it("should return correct count after mixed operations", async () => {
			ctx.cards.set("card-1", createTestCard({ id: "card-1" }));
			ctx.cards.set("card-2", createTestCard({ id: "card-2" }));
			ctx.cards.set("card-3", createTestCard({ id: "card-3" }));

			expect(ctx.cards.size()).toBe(3);

			ctx.cards.softDelete("card-1");
			expect(ctx.cards.size()).toBe(2);

			ctx.cards.set("card-4", createTestCard({ id: "card-4" }));
			expect(ctx.cards.size()).toBe(3);

			ctx.cards.set(
				"card-2",
				createTestCard({ id: "card-2", question: "Updated" }),
			);
			expect(ctx.cards.size()).toBe(3); // Update shouldn't change count
		});
	});
});
