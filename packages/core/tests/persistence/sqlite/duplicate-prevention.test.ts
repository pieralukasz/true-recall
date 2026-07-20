/**
 * Duplicate Prevention Tests
 * Behavior-first tests for preventing duplicate flashcards
 *
 * These tests define expected behavior for duplicate prevention.
 * The createBatch() test is expected to FAIL initially - code needs fixing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardRepository } from "../../../src/flashcard/data/card-repository.service";
import type { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "./__setup__/test-database";

// Mock signals to prevent errors
vi.mock("../../../src/shared/services/signals", () => ({
	notifyCardChange: vi.fn(),
}));

describe("Duplicate Prevention", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
	});

	describe("Duplicate Question Check (CardActions)", () => {
		it("should find card ID by exact question match", async () => {
			const question = "What is the capital of France?";
			const card = createTestCard({ id: "card-123", question });

			ctx.cards.set(card.id, card);

			const foundId = ctx.cards.getCardIdByQuestion(question);
			expect(foundId).toBe("card-123");
		});

		it("should return undefined when question not found", async () => {
			const foundId = ctx.cards.getCardIdByQuestion("Non-existent question");
			expect(foundId).toBeUndefined();
		});

		it("should exclude soft-deleted cards from duplicate check", async () => {
			const question = "What is the capital of France?";
			const card = createTestCard({ id: "card-123", question });

			ctx.cards.set(card.id, card);
			ctx.cards.softDelete(card.id);

			const foundId = ctx.cards.getCardIdByQuestion(question);
			expect(foundId).toBeUndefined();
		});

		it("should distinguish between different questions", async () => {
			ctx.cards.set(
				"card-1",
				createTestCard({ id: "card-1", question: "Question A" }),
			);
			ctx.cards.set(
				"card-2",
				createTestCard({ id: "card-2", question: "Question B" }),
			);

			expect(ctx.cards.getCardIdByQuestion("Question A")).toBe("card-1");
			expect(ctx.cards.getCardIdByQuestion("Question B")).toBe("card-2");
			expect(ctx.cards.getCardIdByQuestion("Question C")).toBeUndefined();
		});

		it("should be case-insensitive for question matching (LIKE-based lookup in v26)", async () => {
			const card = createTestCard({
				id: "card-1",
				question: "What is X?",
			});
			ctx.cards.set(card.id, card);

			// getCardIdByQuestion uses SQL LIKE on notes.fields_json, which is case-insensitive for ASCII in SQLite
			expect(ctx.cards.getCardIdByQuestion("What is X?")).toBe("card-1");
			expect(ctx.cards.getCardIdByQuestion("what is x?")).toBe("card-1");
			expect(ctx.cards.getCardIdByQuestion("WHAT IS X?")).toBe("card-1");
		});

		it("does not report a question contained in another card's answer as duplicate", async () => {
			// Regression: containment-based FTS/LIKE matching flagged a NEW
			// question as duplicate when it merely appeared inside another
			// card's answer text.
			ctx.cards.set(
				"card-1",
				createTestCard({
					id: "card-1",
					question: "Describe photosynthesis",
					answer: "Plants convert light. What is chlorophyll? It is a pigment.",
				}),
			);

			expect(
				ctx.cards.getCardIdByQuestion("What is chlorophyll?"),
			).toBeUndefined();
		});

		it("finds duplicates for questions containing quotes", async () => {
			// Regression: fields_json stores JSON-escaped text, so a raw LIKE
			// never matched questions containing quotes.
			const question = 'He said "hello" to the class';
			ctx.cards.set("card-q", createTestCard({ id: "card-q", question }));

			expect(ctx.cards.getCardIdByQuestion(question)).toBe("card-q");
		});

		it("should match exact whitespace in questions", async () => {
			const card = createTestCard({
				id: "card-1",
				question: "What is X?",
			});
			ctx.cards.set(card.id, card);

			expect(ctx.cards.getCardIdByQuestion("What is X?")).toBe("card-1");
			expect(ctx.cards.getCardIdByQuestion(" What is X?")).toBeUndefined();
			expect(ctx.cards.getCardIdByQuestion("What is X? ")).toBeUndefined();
			expect(ctx.cards.getCardIdByQuestion("What  is X?")).toBeUndefined();
		});
	});

	describe("CardRepository.create() - Duplicate Rejection", () => {
		it("should reject card with duplicate question", async () => {
			const question = "What is the capital of France?";
			const card = createTestCard({ question });
			ctx.cards.set(card.id, card);

			// Create a mock store that delegates to our test context
			const mockStore = {
				cards: ctx.cards,
				get: (id: string) => ctx.cards.get(id),
				set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
				has: (id: string) => ctx.cards.has(id),
			} as unknown as SqliteStoreService;

			const repository = new CardRepository(mockStore);

			expect(() => {
				repository.create(question, "Paris");
			}).toThrow("A card with this question already exists");
		});

		it("should allow different questions", async () => {
			const card = createTestCard({
				question: "What is X?",
			});
			ctx.cards.set(card.id, card);

			const mockStore = {
				cards: ctx.cards,
				get: (id: string) => ctx.cards.get(id),
				set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
				has: (id: string) => ctx.cards.has(id),
			} as unknown as SqliteStoreService;

			const repository = new CardRepository(mockStore);

			const newCard = repository.create("What is Y?", "Answer Y");
			expect(newCard).toBeDefined();
			expect(newCard.question).toBe("What is Y?");
		});

		it("should allow same question after original is soft-deleted", async () => {
			const question = "What is the capital of France?";
			const card = createTestCard({ question });
			ctx.cards.set(card.id, card);
			ctx.cards.softDelete(card.id);

			const mockStore = {
				cards: ctx.cards,
				get: (id: string) => ctx.cards.get(id),
				set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
				has: (id: string) => ctx.cards.has(id),
			} as unknown as SqliteStoreService;

			const repository = new CardRepository(mockStore);

			// Should not throw because original is deleted
			const newCard = repository.create(question, "Paris");
			expect(newCard).toBeDefined();
			expect(newCard.question).toBe(question);
		});
	});

	describe("CardRepository.createBatch() - Partial Success", () => {
		it("should return partial success with duplicates when existing card matches", async () => {
			// Create an existing card
			const existingQuestion = "What is X?";
			const existingCard = createTestCard({ question: existingQuestion });
			ctx.cards.set(existingCard.id, existingCard);

			const mockStore = {
				cards: ctx.cards,
				get: (id: string) => ctx.cards.get(id),
				set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
				has: (id: string) => ctx.cards.has(id),
			} as unknown as SqliteStoreService;

			const repository = new CardRepository(mockStore);

			// Try to create batch with one duplicate
			const flashcards = [
				{ id: "new-1", question: existingQuestion, answer: "A1" }, // Duplicate!
				{ id: "new-2", question: "What is Y?", answer: "A2" }, // New
			];

			const result = repository.createBatch(flashcards, "source123");

			// Should create the non-duplicate and return duplicate info
			expect(result.created).toHaveLength(1);
			expect(result.created[0].question).toBe("What is Y?");
			expect(result.duplicates).toHaveLength(1);
			expect(result.duplicates[0].type).toBe("existing");
			expect(result.duplicates[0].flashcard.question).toBe(existingQuestion);
		});

		it("should detect duplicates within the same batch", async () => {
			const mockStore = {
				cards: ctx.cards,
				get: (id: string) => ctx.cards.get(id),
				set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
				has: (id: string) => ctx.cards.has(id),
			} as unknown as SqliteStoreService;

			const repository = new CardRepository(mockStore);

			// Try to create batch with duplicate questions within the batch
			const flashcards = [
				{ id: "new-1", question: "Same question", answer: "A1" },
				{ id: "new-2", question: "Same question", answer: "A2" }, // Duplicate within batch!
				{ id: "new-3", question: "Different question", answer: "A3" },
			];

			const result = repository.createBatch(flashcards, "source123");

			// Should create first occurrence and different question, skip within-batch duplicate
			expect(result.created).toHaveLength(2);
			expect(result.created.map((c) => c.question)).toContain("Same question");
			expect(result.created.map((c) => c.question)).toContain(
				"Different question",
			);
			expect(result.duplicates).toHaveLength(1);
			expect(result.duplicates[0].type).toBe("batch");
			expect(result.duplicates[0].flashcard.id).toBe("new-2");
		});

		it("should return all duplicates when entire batch consists of duplicates", async () => {
			// Create existing cards
			ctx.cards.set(
				"existing-1",
				createTestCard({ id: "existing-1", question: "Q1" }),
			);
			ctx.cards.set(
				"existing-2",
				createTestCard({ id: "existing-2", question: "Q2" }),
			);

			const mockStore = {
				cards: ctx.cards,
				get: (id: string) => ctx.cards.get(id),
				set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
				has: (id: string) => ctx.cards.has(id),
			} as unknown as SqliteStoreService;

			const repository = new CardRepository(mockStore);

			const flashcards = [
				{ id: "new-1", question: "Q1", answer: "A1" },
				{ id: "new-2", question: "Q2", answer: "A2" },
			];

			const result = repository.createBatch(flashcards, "source123");

			expect(result.created).toHaveLength(0);
			expect(result.duplicates).toHaveLength(2);
		});
	});

	describe("ID Uniqueness", () => {
		it("should overwrite existing card when using same ID (INSERT OR REPLACE)", async () => {
			const id = "same-id";
			const card1 = createTestCard({ id, question: "Question 1" });
			const card2 = createTestCard({ id, question: "Question 2" });

			ctx.cards.set(id, card1);
			expect(ctx.cards.get(id)?.question).toBe("Question 1");

			ctx.cards.set(id, card2);
			expect(ctx.cards.get(id)?.question).toBe("Question 2");

			// Only one card should exist
			expect(ctx.cards.size()).toBe(1);
		});

		it("should generate unique UUIDs across multiple creations", async () => {
			const ids = new Set<string>();

			for (let i = 0; i < 100; i++) {
				const card = createTestCard(); // Uses random ID
				ctx.cards.set(card.id, card);
				ids.add(card.id);
			}

			// All IDs should be unique
			expect(ids.size).toBe(100);
		});
	});
});
