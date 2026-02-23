import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	createTestContext,
	createTestCard,
	getRawCard,
	type TestContext,
} from "../persistence/sqlite/__setup__/test-database";
import { CardRepository } from "../../../src/features/study/services/flashcard/card-repository.service";
import type { SqliteStoreService } from "../../../src/features/core/persistence/sqlite/SqliteStoreService";

const mockNotifyCardChange = vi.fn();
vi.mock("../../../src/shared/services/signals", () => ({
	notifyCardChange: (...args: unknown[]) => mockNotifyCardChange(...args),
	requestSourceHighlight: vi.fn(),
	highlightRequest: { value: null },
}));

function createMockStore(ctx: TestContext): SqliteStoreService {
	return {
		cards: ctx.cards,
		get: (id: string) => ctx.cards.get(id),
		set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
		has: (id: string) => ctx.cards.has(id),
		isReady: () => true,
	} as unknown as SqliteStoreService;
}

describe("Source text linking", () => {
	let ctx: TestContext;
	let repository: CardRepository;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		ctx = await createTestContext();
		repository = new CardRepository(createMockStore(ctx));
		mockNotifyCardChange.mockClear();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	describe("card creation with sourceText", () => {
		it("stores sourceText in the database", () => {
			const card = createTestCard({
				id: "card-src-1",
				sourceUid: "note-abc",
				sourceText: "The mitochondria is the powerhouse of the cell",
			});
			ctx.cards.set(card.id, card);

			const raw = getRawCard(ctx.db, "card-src-1");
			expect(raw).not.toBeNull();
			expect(raw!.source_text).toBe(
				"The mitochondria is the powerhouse of the cell",
			);
		});

		it("retrieves sourceText from the database", () => {
			const card = createTestCard({
				id: "card-src-2",
				sourceUid: "note-abc",
				sourceText: "Photosynthesis converts light energy",
			});
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get("card-src-2");
			expect(retrieved).not.toBeNull();
			expect(retrieved!.sourceText).toBe(
				"Photosynthesis converts light energy",
			);
		});
	});

	describe("backward compatibility without sourceText", () => {
		it("stores null when sourceText is undefined", () => {
			const card = createTestCard({
				id: "card-no-src",
				sourceUid: "note-xyz",
			});
			ctx.cards.set(card.id, card);

			const raw = getRawCard(ctx.db, "card-no-src");
			expect(raw).not.toBeNull();
			expect(raw!.source_text).toBeNull();
		});

		it("retrieves undefined when sourceText is null in DB", () => {
			const card = createTestCard({
				id: "card-no-src-2",
			});
			ctx.cards.set(card.id, card);

			const retrieved = ctx.cards.get("card-no-src-2");
			expect(retrieved).not.toBeNull();
			expect(retrieved!.sourceText).toBeUndefined();
		});
	});

	describe("updateFSRS preserves sourceText", () => {
		it("does not overwrite sourceText when FSRS update has no sourceText", () => {
			const card = createTestCard({
				id: "card-preserve",
				sourceUid: "note-abc",
				sourceText: "Original source text here",
			});
			ctx.cards.set(card.id, card);

			// Simulate an FSRS update (new stability/difficulty after review)
			const updated = createTestCard({
				id: "card-preserve",
				stability: 5.0,
				difficulty: 3.2,
				reps: 1,
				// sourceText intentionally not set — FSRS scheduler doesn't include it
			});

			repository.updateFSRS("card-preserve", updated);

			const retrieved = ctx.cards.get("card-preserve");
			expect(retrieved).not.toBeNull();
			expect(retrieved!.sourceText).toBe("Original source text here");
			expect(retrieved!.stability).toBe(5.0);
		});
	});

	describe("createBatch with per-card sourceText", () => {
		it("uses per-card sourceText when provided", () => {
			const result = repository.createBatch(
				[
					{
						id: "card-a",
						question: "What is A?",
						answer: "Answer A",
						sourceText: "Source text for A.",
					},
					{
						id: "card-b",
						question: "What is B?",
						answer: "Answer B",
						sourceText: "Source text for B.",
					},
				],
				"note-123",
				"TestNote",
				"ai",
			);

			expect(result.created).toHaveLength(2);
			const rawA = getRawCard(ctx.db, "card-a");
			const rawB = getRawCard(ctx.db, "card-b");
			expect(rawA!.source_text).toBe("Source text for A.");
			expect(rawB!.source_text).toBe("Source text for B.");
		});

		it("per-card sourceText overrides batch-level sourceText", () => {
			const result = repository.createBatch(
				[
					{
						id: "card-override",
						question: "Override question?",
						answer: "Override answer",
						sourceText: "Per-card source.",
					},
				],
				"note-456",
				"TestNote",
				"ai",
				"Batch-level source text",
			);

			expect(result.created).toHaveLength(1);
			const raw = getRawCard(ctx.db, "card-override");
			expect(raw!.source_text).toBe("Per-card source.");
		});

		it("falls back to batch-level sourceText when per-card is undefined", () => {
			const result = repository.createBatch(
				[
					{
						id: "card-fallback",
						question: "Fallback question?",
						answer: "Fallback answer",
					},
				],
				"note-789",
				"TestNote",
				"ai",
				"Batch-level fallback",
			);

			expect(result.created).toHaveLength(1);
			const raw = getRawCard(ctx.db, "card-fallback");
			expect(raw!.source_text).toBe("Batch-level fallback");
		});

		it("mixed batch — some cards with per-card source, some with batch fallback", () => {
			const result = repository.createBatch(
				[
					{
						id: "card-with",
						question: "Card with source?",
						answer: "Has its own",
						sourceText: "Individual source.",
					},
					{
						id: "card-without",
						question: "Card without source?",
						answer: "Falls back",
					},
				],
				"note-mix",
				"TestNote",
				"ai",
				"Batch fallback text",
			);

			expect(result.created).toHaveLength(2);
			const rawWith = getRawCard(ctx.db, "card-with");
			const rawWithout = getRawCard(ctx.db, "card-without");
			expect(rawWith!.source_text).toBe("Individual source.");
			expect(rawWithout!.source_text).toBe("Batch fallback text");
		});
	});

	describe("signal communication", () => {
		it("requestSourceHighlight updates signal with incremented requestId and mode", async () => {
			const { requestSourceHighlight, highlightRequest } = await vi.importActual<
				typeof import("../../../src/shared/services/signals")
			>("../../../src/shared/services/signals");

			requestSourceHighlight("notes/biology.md", "Cell division");
			const req1 = highlightRequest.value;
			expect(req1).not.toBeNull();
			expect(req1!.sourceNotePath).toBe("notes/biology.md");
			expect(req1!.sourceText).toBe("Cell division");
			expect(req1!.requestId).toBeGreaterThan(0);
			expect(req1!.mode).toBe("jump");

			requestSourceHighlight("notes/physics.md", "Gravity", "hover");
			const req2 = highlightRequest.value;
			expect(req2!.requestId).toBeGreaterThan(req1!.requestId);
			expect(req2!.sourceNotePath).toBe("notes/physics.md");
			expect(req2!.mode).toBe("hover");
		});

		it("clearSourceHighlight sets signal to null", async () => {
			const { requestSourceHighlight, clearSourceHighlight, highlightRequest } =
				await vi.importActual<
					typeof import("../../../src/shared/services/signals")
				>("../../../src/shared/services/signals");

			requestSourceHighlight("notes/test.md", "Some text");
			expect(highlightRequest.value).not.toBeNull();

			clearSourceHighlight();
			expect(highlightRequest.value).toBeNull();
		});
	});
});
