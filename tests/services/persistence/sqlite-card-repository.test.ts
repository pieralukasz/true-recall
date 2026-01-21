/**
 * Tests for SqliteCardRepository
 * Specifically tests created_at preservation on updates
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { SqliteCardRepository } from "../../../src/services/persistence/sqlite/SqliteCardRepository";
import { createMockCard } from "../mocks/fsrs.mocks";

describe("SqliteCardRepository", () => {
	let db: Database;
	let repo: SqliteCardRepository;
	let onDataChange: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		// Initialize in-memory database
		const SQL = await initSqlJs();
		db = new SQL.Database();
		onDataChange = vi.fn();

		// Create cards table
		db.run(`
			CREATE TABLE cards (
				id TEXT PRIMARY KEY,
				due TEXT NOT NULL,
				stability REAL DEFAULT 0,
				difficulty REAL DEFAULT 0,
				reps INTEGER DEFAULT 0,
				lapses INTEGER DEFAULT 0,
				state INTEGER DEFAULT 0,
				last_review TEXT,
				scheduled_days INTEGER DEFAULT 0,
				learning_step INTEGER DEFAULT 0,
				suspended INTEGER DEFAULT 0,
				buried_until TEXT,
				created_at INTEGER,
				updated_at INTEGER,
				question TEXT,
				answer TEXT,
				source_uid TEXT
			)
		`);

		repo = new SqliteCardRepository(db, onDataChange);
	});

	describe("set - created_at preservation", () => {
		it("should set created_at to now for new cards", () => {
			const before = Date.now();
			const card = createMockCard({
				id: "new-card",
				createdAt: undefined,
			});

			repo.set(card.id, card);
			const after = Date.now();

			const result = repo.get("new-card");
			expect(result).not.toBeUndefined();
			expect(result!.createdAt).toBeGreaterThanOrEqual(before);
			expect(result!.createdAt).toBeLessThanOrEqual(after);
		});

		it("should preserve provided created_at for new cards", () => {
			const specificTime = 1704067200000; // 2024-01-01 00:00:00 UTC
			const card = createMockCard({
				id: "timed-card",
				createdAt: specificTime,
			});

			repo.set(card.id, card);

			const result = repo.get("timed-card");
			expect(result!.createdAt).toBe(specificTime);
		});

		it("should preserve original created_at when updating existing card without createdAt", () => {
			// First, create a card with a specific created_at
			const originalCreatedAt = 1704067200000; // 2024-01-01
			const originalCard = createMockCard({
				id: "update-test",
				createdAt: originalCreatedAt,
				reps: 0,
			});
			repo.set(originalCard.id, originalCard);

			// Verify initial state
			let result = repo.get("update-test");
			expect(result!.createdAt).toBe(originalCreatedAt);

			// Update the card without providing createdAt (simulating a review update)
			// This is the key scenario - spread from existing but createdAt is lost
			const updatedCard = createMockCard({
				id: "update-test",
				reps: 1, // Changed field
			});
			// Explicitly remove createdAt to simulate the bug scenario
			delete (updatedCard as { createdAt?: number }).createdAt;
			repo.set(updatedCard.id, updatedCard);

			// Verify created_at is preserved
			result = repo.get("update-test");
			expect(result!.createdAt).toBe(originalCreatedAt);
			expect(result!.reps).toBe(1); // Other fields should be updated
		});

		it("should allow explicit override of created_at on update", () => {
			// Create card with original timestamp
			const originalCreatedAt = 1704067200000;
			const originalCard = createMockCard({
				id: "override-test",
				createdAt: originalCreatedAt,
			});
			repo.set(originalCard.id, originalCard);

			// Update with explicit new created_at
			const newCreatedAt = 1706745600000; // Different timestamp
			const updatedCard = createMockCard({
				id: "override-test",
				createdAt: newCreatedAt,
			});
			repo.set(updatedCard.id, updatedCard);

			// New created_at should be used
			const result = repo.get("override-test");
			expect(result!.createdAt).toBe(newCreatedAt);
		});

		it("should preserve created_at through multiple updates", () => {
			const originalCreatedAt = 1704067200000;
			const card = createMockCard({
				id: "multi-update",
				createdAt: originalCreatedAt,
				reps: 0,
			});
			repo.set(card.id, card);

			// Multiple updates without createdAt
			for (let i = 1; i <= 5; i++) {
				const update = createMockCard({
					id: "multi-update",
					reps: i,
				});
				// Explicitly remove createdAt to simulate the bug scenario
				delete (update as { createdAt?: number }).createdAt;
				repo.set(update.id, update);
			}

			const result = repo.get("multi-update");
			expect(result!.createdAt).toBe(originalCreatedAt);
			expect(result!.reps).toBe(5);
		});
	});

	describe("basic CRUD operations", () => {
		it("should insert and retrieve a card", () => {
			const card = createMockCard({
				id: "test-card",
				question: "Test Q",
				answer: "Test A",
			});

			repo.set(card.id, card);

			const result = repo.get("test-card");
			expect(result).not.toBeUndefined();
			expect(result!.id).toBe("test-card");
			expect(result!.question).toBe("Test Q");
			expect(result!.answer).toBe("Test A");
		});

		it("should return undefined for non-existent card", () => {
			const result = repo.get("non-existent");
			expect(result).toBeUndefined();
		});

		it("should delete a card", () => {
			const card = createMockCard({ id: "delete-me" });
			repo.set(card.id, card);

			repo.delete("delete-me");

			expect(repo.get("delete-me")).toBeUndefined();
		});

		it("should check if card exists", () => {
			const card = createMockCard({ id: "exists-test" });
			repo.set(card.id, card);

			expect(repo.has("exists-test")).toBe(true);
			expect(repo.has("does-not-exist")).toBe(false);
		});

		it("should return correct size", () => {
			expect(repo.size()).toBe(0);

			repo.set("card-1", createMockCard({ id: "card-1" }));
			repo.set("card-2", createMockCard({ id: "card-2" }));

			expect(repo.size()).toBe(2);
		});
	});
});
