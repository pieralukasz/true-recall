import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardRepository } from "../../src/flashcard/data/card-repository.service";
import type { SqliteStoreService } from "../../src/persistence/sqlite/SqliteStoreService";
import {
	createTestContext,
	type TestContext,
} from "../persistence/sqlite/__setup__/test-database";

const mockBusEmit = vi.fn();

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
		repository.setEventBus({
			emit: mockBusEmit,
			on: vi.fn(() => () => {}),
		} as never);
		mockBusEmit.mockClear();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	describe("updateContent()", () => {
		it("can restore prior content despite a later duplicate and still emits an update", () => {
			const card = repository.create("Original question", "Original answer");
			repository.updateContent(card.id, "Edited question", "Edited answer");
			repository.create("Original question", "Another answer");
			mockBusEmit.mockClear();

			repository.updateContent(
				card.id,
				"Original question",
				"Original answer",
				{ skipDuplicateCheck: true },
			);

			expect(ctx.cards.get(card.id)?.question).toBe("Original question");
			expect(mockBusEmit).toHaveBeenCalledWith(
				"card:updated",
				expect.objectContaining({ cardId: card.id }),
			);
		});
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
				},
			);

			const stored = ctx.cards.get(card.id);
			expect(stored).not.toBeUndefined();
			expect(stored?.cardType).toBe("cloze");
			expect(stored?.clozeTemplate).toBe("{{c1::France}} is in {{c2::Europe}}");
			expect(stored?.clozeIndex).toBe(1);
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
				},
			);

			expect(card.cardType).toBe("cloze");
			expect(card.clozeTemplate).toBe("{{c1::France}} is in {{c2::Europe}}");
			expect(card.clozeIndex).toBe(1);
		});

		it("defaults to basic when no cloze options", () => {
			const card = repository.create("What is 2+2?", "4");

			const stored = ctx.cards.get(card.id);
			expect(stored).not.toBeUndefined();
			expect(stored?.cardType).toBe("basic");
			expect(stored?.clozeTemplate).toBeUndefined();
			expect(stored?.clozeIndex).toBeUndefined();
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
				"My Note",
			);

			expect(result.created).toHaveLength(2);

			const stored1 = ctx.cards.get("cloze-1");
			expect(stored1?.cardType).toBe("cloze");
			expect(stored1?.clozeTemplate).toBe(TEMPLATE);
			expect(stored1?.clozeIndex).toBe(1);
			expect(stored1?.sourceUid).toBe("source-uid-1");

			const stored2 = ctx.cards.get("cloze-2");
			expect(stored2?.cardType).toBe("cloze");
			expect(stored2?.clozeTemplate).toBe(TEMPLATE);
			expect(stored2?.clozeIndex).toBe(2);
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
				"source-uid-1",
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
				"source-uid-1",
			);

			expect(result.created).toHaveLength(0);
			expect(result.duplicates).toHaveLength(1);
			expect(result.duplicates[0]?.type).toBe("existing");
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
				"source-A",
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
				"source-B",
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
				"source-uid-1",
			);

			expect(result.created).toHaveLength(1);
			const stored = ctx.cards.get("basic-1");
			expect(stored?.cardType).toBe("basic");
			expect(stored?.clozeTemplate).toBeUndefined();
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
				"source-uid-1",
			);

			expect(result.created).toHaveLength(3);

			const storedBasic = ctx.cards.get("basic-1");
			expect(storedBasic?.cardType).toBe("basic");

			const storedCloze = ctx.cards.get("cloze-1");
			expect(storedCloze?.cardType).toBe("cloze");
			expect(storedCloze?.clozeTemplate).toBe(TEMPLATE);
		});
	});

	describe("createBatch() with reversed cards", () => {
		it("stores reverse_of linking reversed to original", () => {
			// Use non-overlapping Q/A to avoid false-positive duplicate detection
			// (getCardInfoByQuestion uses LIKE on fields_json which matches both Q and A)
			const result = repository.createBatch(
				[
					{
						id: "orig-1",
						question: "Capital of France?",
						answer: "Paris",
					},
					{
						id: "rev-1",
						question: "Paris is the capital of?",
						answer: "France",
						cardType: "reversed",
						reverseOfBatchId: "orig-1",
					},
				],
				"source-uid-1",
			);

			expect(result.created).toHaveLength(2);

			const storedOrig = ctx.cards.get(result.created[0]?.id);
			const storedRev = ctx.cards.get(result.created[1]?.id);
			expect(storedRev?.cardType).toBe("reversed");
			// Both cards share the same note (v26 reversed architecture)
			expect(storedRev?.noteId).toBe(storedOrig?.noteId);
			// The reverse card should be discoverable via getCardByReverseOf
			const foundReverse = ctx.cards.getCardByReverseOf(result.created[0]?.id);
			expect(foundReverse).toBeDefined();
			expect(foundReverse?.id).toBe(result.created[1]?.id);
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
				"source-uid-1",
			);

			mockBusEmit.mockClear();

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
				"source-uid-1",
			);

			mockBusEmit.mockClear();
			repository.delete("c1");

			expect(mockBusEmit).toHaveBeenCalledWith(
				"card:removed",
				expect.objectContaining({
					cardId: "c1",
				}),
			);
		});

		it("does not cascade for basic cards", () => {
			repository.createBatch(
				[
					{ id: "basic-1", question: "Q1", answer: "A1" },
					{ id: "basic-2", question: "Q2", answer: "A2" },
				],
				"source-uid-1",
			);

			repository.delete("basic-1");

			// basic-2 should still exist
			expect(ctx.cards.get("basic-2")).toBeDefined();
		});

		it("does not cascade to a different cloze block in the same source note", () => {
			const TEMPLATE_A = "{{c1::Tokyo}} is in {{c2::Japan}}";
			const TEMPLATE_B = "{{c1::Berlin}} is in {{c2::Germany}}";

			repository.createBatch(
				[
					{
						id: "a1",
						question: "[...] is in Japan",
						answer: "**Tokyo** is in Japan",
						cardType: "cloze",
						clozeTemplate: TEMPLATE_A,
						clozeIndex: 1,
					},
					{
						id: "a2",
						question: "Tokyo is in [...]",
						answer: "Tokyo is in **Japan**",
						cardType: "cloze",
						clozeTemplate: TEMPLATE_A,
						clozeIndex: 2,
					},
					{
						id: "b1",
						question: "[...] is in Germany",
						answer: "**Berlin** is in Germany",
						cardType: "cloze",
						clozeTemplate: TEMPLATE_B,
						clozeIndex: 1,
					},
					{
						id: "b2",
						question: "Berlin is in [...]",
						answer: "Berlin is in **Germany**",
						cardType: "cloze",
						clozeTemplate: TEMPLATE_B,
						clozeIndex: 2,
					},
				],
				"source-shared",
			);

			// Deleting a card from block A must only cascade within block A.
			repository.delete("a1");

			expect(ctx.cards.get("a1")).toBeUndefined();
			expect(ctx.cards.get("a2")).toBeUndefined();
			expect(ctx.cards.get("b1")).toBeDefined();
			expect(ctx.cards.get("b2")).toBeDefined();
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
				"source-A",
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
				"source-B",
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
				SOURCE_UID,
			);
			mockBusEmit.mockClear();
		});

		it("updates Q/A for existing siblings when template text changes", () => {
			const newTemplate = "{{c1::Italy}} is in {{c2::Europe}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			const card1 = ctx.cards.get("c1");
			expect(card1).toBeDefined();
			expect(card1?.question).toBe("[...] is in Europe");
			// Answer includes <br>{{Extra}} from cloze afmt template
			expect(card1?.answer).toBe("**Italy** is in Europe<br>");
			expect(card1?.clozeTemplate).toBe(newTemplate);

			const card2 = ctx.cards.get("c2");
			expect(card2).toBeDefined();
			expect(card2?.question).toBe("Italy is in [...]");
			expect(card2?.answer).toBe("Italy is in **Europe**<br>");
		});

		it("creates new card when cloze index is added", () => {
			const newTemplate =
				"{{c1::France}} is in {{c2::Europe}}, specifically {{c3::Western Europe}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			// c1 and c2 should be updated
			expect(ctx.cards.get("c1")).toBeDefined();
			expect(ctx.cards.get("c2")).toBeDefined();

			// c3 should be a new card
			const siblings = ctx.cards.getClozeSiblings(SOURCE_UID, newTemplate);
			expect(siblings).toHaveLength(3);

			const c3 = siblings.find((s) => s.clozeIndex === 3);
			expect(c3).toBeDefined();
			expect(c3?.question).toContain("[...]");
		});

		it("attaches a new cloze sibling to the siblings' shared note", () => {
			const newTemplate =
				"{{c1::France}} is in {{c2::Europe}}, specifically {{c3::Western Europe}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			// Regression: the new card used to get its own brand-new note,
			// fragmenting the cloze note and losing its Extra field.
			const siblings = ctx.cards.getClozeSiblings(SOURCE_UID, newTemplate);
			const c1 = siblings.find((s) => s.clozeIndex === 1);
			const c3 = siblings.find((s) => s.clozeIndex === 3);
			expect(c1?.noteId).toBeDefined();
			expect(c3?.noteId).toBe(c1?.noteId);
		});

		it("soft-deletes card when cloze index is removed", () => {
			const newTemplate = "{{c1::France}} is a country";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			// c1 should be updated
			const card1 = ctx.cards.get("c1");
			expect(card1).toBeDefined();
			expect(card1?.clozeTemplate).toBe(newTemplate);

			// c2 should be soft-deleted (cloze index 2 no longer exists)
			const card2 = ctx.cards.get("c2");
			expect(card2).toBeUndefined();
		});

		it("notifies content-only updates when cloze indices are unchanged", () => {
			const newTemplate = "{{c1::Italy}} is in {{c2::Europe}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			// Same card set — consumers can take the cheap content-only
			// invalidation path instead of a full bulk reload.
			expect(mockBusEmit).toHaveBeenCalledWith(
				"card:updated",
				expect.objectContaining({
					changes: { question: true, answer: true },
				}),
			);
			expect(mockBusEmit).not.toHaveBeenCalledWith(
				"cards:bulk",
				expect.anything(),
			);
		});

		it("notifies bulk change when adding new siblings", () => {
			const newTemplate =
				"{{c1::France}} is in {{c2::Europe}}, part of {{c3::EU}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			expect(mockBusEmit).toHaveBeenCalledWith(
				"cards:bulk",
				expect.objectContaining({
					cardIds: expect.any(Array),
				}),
			);
		});

		it("notifies bulk change when removing siblings", () => {
			const newTemplate = "{{c1::France}} is a country";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);

			expect(mockBusEmit).toHaveBeenCalledWith(
				"cards:bulk",
				expect.objectContaining({
					cardIds: expect.any(Array),
				}),
			);
		});

		it("restores the original sibling ids and emits a bulk refresh", () => {
			const newTemplate =
				"{{c1::France}} is specifically in {{c3::Western Europe}}";
			repository.updateClozeTemplate(SOURCE_UID, OLD_TEMPLATE, newTemplate);
			const editedSiblings = ctx.cards.getClozeSiblings(
				SOURCE_UID,
				newTemplate,
			);
			expect(editedSiblings.some((card) => card.id === "c2")).toBe(false);
			const addedId = editedSiblings.find((card) => card.clozeIndex === 3)?.id;
			expect(addedId).toBeDefined();
			mockBusEmit.mockClear();

			repository.restoreClozeTemplate(SOURCE_UID, newTemplate, OLD_TEMPLATE, [
				"c1",
				"c2",
			]);

			const restored = ctx.cards.getClozeSiblings(SOURCE_UID, OLD_TEMPLATE);
			expect(restored.map((card) => card.id).sort()).toEqual(["c1", "c2"]);
			expect(addedId ? ctx.cards.get(addedId) : undefined).toBeUndefined();
			expect(mockBusEmit).toHaveBeenCalledWith(
				"cards:bulk",
				expect.objectContaining({
					cardIds: expect.arrayContaining(["c1", "c2", addedId]),
				}),
			);
		});
	});
});
