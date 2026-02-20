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
}));

function createMockStore(ctx: TestContext): SqliteStoreService {
	return {
		cards: ctx.cards,
		get: (id: string) => ctx.cards.get(id),
		set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
		has: (id: string) => ctx.cards.has(id),
		getClozeSiblings: (sourceUid: string, clozeTemplate: string) =>
			ctx.cards.getClozeSiblings(sourceUid, clozeTemplate),
		isReady: () => true,
	} as unknown as SqliteStoreService;
}

describe("CardRepository - cloze operations", () => {
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

	describe("create() with cloze options", () => {
		it("stores cardType, clozeTemplate, clozeIndex in database", () => {
			const card = repository.create(
				"[...] is in Europe",
				"**France** is in Europe",
				"source-123",
				"Geography Note",
				{
					cardType: "cloze",
					clozeTemplate: "{{c1::France}} is in {{c2::Europe}}",
					clozeIndex: 1,
				}
			);

			const raw = getRawCard(ctx.db, card.id);
			expect(raw).not.toBeNull();
			expect(raw!.card_type).toBe("cloze");
			expect(raw!.cloze_template).toBe("{{c1::France}} is in {{c2::Europe}}");
			expect(raw!.cloze_index).toBe(1);
		});

		it("returns card with cloze fields", () => {
			const card = repository.create(
				"[...] is in Europe",
				"**France** is in Europe",
				"source-123",
				undefined,
				{
					cardType: "cloze",
					clozeTemplate: "{{c1::France}} is in {{c2::Europe}}",
					clozeIndex: 1,
				}
			);

			expect(card.cardType).toBe("cloze");
			expect(card.clozeTemplate).toBe("{{c1::France}} is in {{c2::Europe}}");
			expect(card.clozeIndex).toBe(1);
		});

		it("defaults to basic when no cloze options", () => {
			const card = repository.create("What is 2+2?", "4");

			const raw = getRawCard(ctx.db, card.id);
			expect(raw!.card_type).toBe("basic");
			expect(raw!.cloze_template).toBeNull();
			expect(raw!.cloze_index).toBeNull();
		});
	});

	describe("createBatch() with cloze cards", () => {
		const TEMPLATE = "{{c1::France}} is in {{c2::Europe}}";

		it("stores cloze fields for all cards in batch", () => {
			const result = repository.createBatch(
				[
					{
						id: "cloze-1",
						question: "[...] is in Europe",
						answer: "**France** is in Europe",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
					{
						id: "cloze-2",
						question: "France is in [...]",
						answer: "France is in **Europe**",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 2,
					},
				],
				"source-uid-1",
				"My Note"
			);

			expect(result.created).toHaveLength(2);

			const raw1 = getRawCard(ctx.db, "cloze-1");
			expect(raw1!.card_type).toBe("cloze");
			expect(raw1!.cloze_template).toBe(TEMPLATE);
			expect(raw1!.cloze_index).toBe(1);
			expect(raw1!.source_uid).toBe("source-uid-1");

			const raw2 = getRawCard(ctx.db, "cloze-2");
			expect(raw2!.card_type).toBe("cloze");
			expect(raw2!.cloze_template).toBe(TEMPLATE);
			expect(raw2!.cloze_index).toBe(2);
		});

		it("detects cloze-specific duplicates by sourceUid + template + index", () => {
			// First batch creates cloze cards
			repository.createBatch(
				[
					{
						id: "cloze-1",
						question: "[...] is in Europe",
						answer: "**France** is in Europe",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
				],
				"source-uid-1"
			);

			// Second batch tries to create same cloze (same source, template, index)
			const result = repository.createBatch(
				[
					{
						id: "cloze-1-dup",
						question: "[...] is in Europe",
						answer: "**France** is in Europe",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
				],
				"source-uid-1"
			);

			expect(result.created).toHaveLength(0);
			expect(result.duplicates).toHaveLength(1);
			expect(result.duplicates[0]!.type).toBe("existing");
		});

		it("allows same cloze index from different source notes", () => {
			repository.createBatch(
				[
					{
						id: "note1-c1",
						question: "[...] is in Europe (note A)",
						answer: "**France** is in Europe",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
				],
				"source-A"
			);

			const result = repository.createBatch(
				[
					{
						id: "note2-c1",
						question: "[...] is in Europe (note B)",
						answer: "**France** is in Europe",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
				],
				"source-B"
			);

			// Different source_uid means it's not a duplicate
			expect(result.created).toHaveLength(1);
		});

		it("creates cards without cloze fields as basic", () => {
			const result = repository.createBatch(
				[
					{
						id: "basic-1",
						question: "What is 2+2?",
						answer: "4",
					},
				],
				"source-uid-1"
			);

			expect(result.created).toHaveLength(1);
			const raw = getRawCard(ctx.db, "basic-1");
			expect(raw!.card_type).toBe("basic");
			expect(raw!.cloze_template).toBeNull();
		});

		it("handles mixed cloze and basic cards in one batch", () => {
			const result = repository.createBatch(
				[
					{
						id: "basic-1",
						question: "Simple question?",
						answer: "Simple answer",
					},
					{
						id: "cloze-1",
						question: "[...] is in Europe",
						answer: "**France** is in Europe",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
					{
						id: "cloze-2",
						question: "France is in [...]",
						answer: "France is in **Europe**",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 2,
					},
				],
				"source-uid-1"
			);

			expect(result.created).toHaveLength(3);

			const rawBasic = getRawCard(ctx.db, "basic-1");
			expect(rawBasic!.card_type).toBe("basic");

			const rawCloze = getRawCard(ctx.db, "cloze-1");
			expect(rawCloze!.card_type).toBe("cloze");
			expect(rawCloze!.cloze_template).toBe(TEMPLATE);
		});
	});

	describe("createBatch() with reversed cards", () => {
		it("stores reverse_of linking reversed to original", () => {
			const result = repository.createBatch(
				[
					{
						id: "orig-1",
						question: "What is X?",
						answer: "Definition of X",
					},
					{
						id: "rev-1",
						question: "Definition of X",
						answer: "What is X?",
						cardType: "reversed",
						reverseOfBatchId: "orig-1",
					},
				],
				"source-uid-1"
			);

			expect(result.created).toHaveLength(2);

			const rawRev = getRawCard(ctx.db, result.created[1]!.id);
			expect(rawRev!.card_type).toBe("reversed");
			// reverse_of should be resolved to the DB ID of the original
			expect(rawRev!.reverse_of).toBe(result.created[0]!.id);
		});
	});

	describe("delete() with cloze cascade", () => {
		const TEMPLATE = "{{c1::Tokyo}} is in {{c2::Japan}}";

		it("cascade-deletes all cloze siblings when deleting one", () => {
			repository.createBatch(
				[
					{
						id: "c1",
						question: "[...] is in Japan",
						answer: "**Tokyo** is in Japan",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
					{
						id: "c2",
						question: "Tokyo is in [...]",
						answer: "Tokyo is in **Japan**",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 2,
					},
				],
				"source-uid-1"
			);

			mockNotifyCardChange.mockClear();

			// Delete just c1 - should cascade to c2
			const removed = repository.delete("c1");
			expect(removed).toBe(true);

			// Both cards should be soft-deleted
			expect(ctx.cards.get("c1")).toBeUndefined();
			expect(ctx.cards.get("c2")).toBeUndefined();
		});

		it("emits card:removed event for each cascade-deleted sibling", () => {
			repository.createBatch(
				[
					{
						id: "c1",
						question: "[...] is in Japan",
						answer: "**Tokyo** is in Japan",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
					{
						id: "c2",
						question: "Tokyo is in [...]",
						answer: "Tokyo is in **Japan**",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 2,
					},
				],
				"source-uid-1"
			);

			mockNotifyCardChange.mockClear();
			repository.delete("c1");

			expect(mockNotifyCardChange).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "removed",
				}),
			);
		});

		it("does not cascade for basic cards", () => {
			repository.createBatch(
				[
					{ id: "basic-1", question: "Q1", answer: "A1" },
					{ id: "basic-2", question: "Q2", answer: "A2" },
				],
				"source-uid-1"
			);

			repository.delete("basic-1");

			// basic-2 should still exist
			expect(ctx.cards.get("basic-2")).toBeDefined();
		});

		it("does not cascade to cloze cards from different source", () => {
			repository.createBatch(
				[
					{
						id: "c1-note-a",
						question: "[...] is in Japan (note A)",
						answer: "**Tokyo** is in Japan",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
				],
				"source-A"
			);

			repository.createBatch(
				[
					{
						id: "c1-note-b",
						question: "[...] is in Japan (note B)",
						answer: "**Tokyo** is in Japan",
						cardType: "cloze",
						clozeTemplate: TEMPLATE,
						clozeIndex: 1,
					},
				],
				"source-B"
			);

			repository.delete("c1-note-a");

			// Card from source-B should still exist
			expect(ctx.cards.get("c1-note-b")).toBeDefined();
		});
	});

	describe("updateClozeTemplate()", () => {
		const OLD_TEMPLATE = "{{c1::France}} is in {{c2::Europe}}";
		const SOURCE_UID = "source-123";

		beforeEach(() => {
			repository.createBatch(
				[
					{
						id: "c1",
						question: "[...] is in Europe",
						answer: "**France** is in Europe",
						cardType: "cloze",
						clozeTemplate: OLD_TEMPLATE,
						clozeIndex: 1,
					},
					{
						id: "c2",
						question: "France is in [...]",
						answer: "France is in **Europe**",
						cardType: "cloze",
						clozeTemplate: OLD_TEMPLATE,
						clozeIndex: 2,
					},
				],
				SOURCE_UID
			);
			mockNotifyCardChange.mockClear();
		});

		it("updates Q/A for existing siblings when template text changes", () => {
			const newTemplate = "{{c1::Italy}} is in {{c2::Europe}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			const card1 = ctx.cards.get("c1");
			expect(card1).toBeDefined();
			expect(card1!.question).toBe("[...] is in Europe");
			expect(card1!.answer).toBe("**Italy** is in Europe");
			expect(card1!.clozeTemplate).toBe(newTemplate);

			const card2 = ctx.cards.get("c2");
			expect(card2).toBeDefined();
			expect(card2!.question).toBe("Italy is in [...]");
			expect(card2!.answer).toBe("Italy is in **Europe**");
		});

		it("creates new card when cloze index is added", () => {
			const newTemplate = "{{c1::France}} is in {{c2::Europe}}, specifically {{c3::Western Europe}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			// c1 and c2 should be updated
			expect(ctx.cards.get("c1")).toBeDefined();
			expect(ctx.cards.get("c2")).toBeDefined();

			// c3 should be a new card
			const siblings = ctx.cards.getClozeSiblings(SOURCE_UID, newTemplate);
			expect(siblings).toHaveLength(3);

			const c3 = siblings.find((s) => s.clozeIndex === 3);
			expect(c3).toBeDefined();
			expect(c3!.question).toContain("[...]");
		});

		it("soft-deletes card when cloze index is removed", () => {
			const newTemplate = "{{c1::France}} is a country";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			// c1 should be updated
			const card1 = ctx.cards.get("c1");
			expect(card1).toBeDefined();
			expect(card1!.clozeTemplate).toBe(newTemplate);

			// c2 should be soft-deleted (cloze index 2 no longer exists)
			const card2 = ctx.cards.get("c2");
			expect(card2).toBeUndefined();
		});

		it("notifies bulk change after updating siblings", () => {
			const newTemplate = "{{c1::Italy}} is in {{c2::Europe}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			expect(mockNotifyCardChange).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "bulk",
				}),
			);
		});

		it("notifies bulk change when adding new siblings", () => {
			const newTemplate = "{{c1::France}} is in {{c2::Europe}}, part of {{c3::EU}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			expect(mockNotifyCardChange).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "bulk",
				}),
			);
		});

		it("notifies bulk change when removing siblings", () => {
			const newTemplate = "{{c1::France}} is a country";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			expect(mockNotifyCardChange).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "bulk",
				}),
			);
		});
	});
});
