import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardRepository } from "../../src/flashcard/data/card-repository.service";
import { ImageOcclusionReconciler } from "../../src/flashcard/image-occlusion-reconciler";
import { NoteCreationService } from "../../src/flashcard/note-creation.service";
import { NoteMutationService } from "../../src/flashcard/note-mutation.service";
import type { SqliteStoreService } from "../../src/persistence/sqlite/SqliteStoreService";
import type { IODefinition } from "../../src/types/image-occlusion.types";
import {
	mergeIORegions,
	mergeSelectedIORegions,
	parseIODefinition,
	serializeIODefinition,
} from "../../src/utils/io-definition";
import {
	createTestContext,
	type TestContext,
} from "../persistence/sqlite/__setup__/test-database";

function createDefinition(): IODefinition {
	return {
		version: 1,
		maskMode: "all",
		hideOtherRegions: true,
		regions: [4, 7, 9].map((ord) => ({
			id: `r${ord}`,
			x: 0.1,
			y: 0.1,
			w: 0.1,
			h: 0.1,
			shape: "rect",
			groupKey: String(ord),
		})),
	};
}
describe("image occlusion independent cards", () => {
	let ctx: TestContext;
	let io: ImageOcclusionReconciler;
	let repository: CardRepository;
	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-22T10:00:00Z"));
		ctx = await createTestContext();
		const store = {
			...ctx,
			get: ctx.cards.get.bind(ctx.cards),
			set: ctx.cards.set.bind(ctx.cards),
		} as unknown as SqliteStoreService;
		const creation = new NoteCreationService(() => store, vi.fn());
		let mutation: NoteMutationService;
		io = new ImageOcclusionReconciler(
			() => store,
			creation,
			(id, fields) => mutation.updateNoteFields(id, fields),
			vi.fn(),
			vi.fn(),
		);
		mutation = new NoteMutationService(
			() => store,
			creation,
			io,
			vi.fn(),
			vi.fn(),
		);
		repository = new CardRepository(store);
	});
	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});
	it("deletes only the selected image card, and never identifies another region as a reverse", () => {
		const { cards } = io.createImageOcclusionNote({
			imagePath: "Images/brain.png",
			definition: createDefinition(),
		});
		for (const card of cards)
			expect(ctx.cards.getCardByReverseOf(card.id)).toBeUndefined();
		expect(repository.deleteWithCascade(cards[1].id).removedIds).toEqual([
			cards[1].id,
		]);
		expect(ctx.cards.get(cards[0].id)?.templateOrd).toBe(4);
		expect(ctx.cards.get(cards[2].id)?.templateOrd).toBe(9);
	});
	it("explicit merging preserves the lowest existing card's ID and scheduling", () => {
		const definition = createDefinition();
		const { note, cards } = io.createImageOcclusionNote({
			imagePath: "Images/brain.png",
			definition,
		});
		const survivor = cards[0];
		ctx.cards.set(survivor.id, {
			...survivor,
			reps: 12,
			stability: 24,
			due: "2026-10-20T10:00:00Z",
		});
		io.updateImageOcclusionNote(note.id, {
			imagePath: "Images/brain.png",
			definition: mergeIORegions(definition),
		});
		const kept = ctx.cards.getCardsByNoteId(note.id);
		expect(kept).toHaveLength(1);
		expect(kept[0]).toMatchObject({
			id: survivor.id,
			templateOrd: 4,
			reps: 12,
			stability: 24,
			due: "2026-10-20T10:00:00Z",
		});
		expect(definition.regions.map((r) => r.groupKey)).toEqual(["4", "7", "9"]);
	});
	it("merging selected regions keeps the lowest selected card and leaves the rest untouched", () => {
		const definition = createDefinition();
		const { note, cards } = io.createImageOcclusionNote({
			imagePath: "Images/brain.png",
			definition,
		});
		const byOrd = new Map(cards.map((card) => [card.templateOrd, card]));
		const survivor = byOrd.get(7);
		const untouched = byOrd.get(4);
		if (!survivor || !untouched) throw new Error("missing cards");
		ctx.cards.set(survivor.id, { ...survivor, reps: 5, stability: 11 });
		ctx.cards.set(untouched.id, { ...untouched, reps: 3, stability: 6 });

		const merged = mergeSelectedIORegions(definition, ["r9", "r7"]);
		expect(merged.regions.map((r) => r.groupKey)).toEqual(["4", "7", "7"]);
		io.updateImageOcclusionNote(note.id, {
			imagePath: "Images/brain.png",
			definition: merged,
		});

		const kept = ctx.cards.getCardsByNoteId(note.id);
		expect(kept.map((card) => card.templateOrd).sort()).toEqual([4, 7]);
		expect(ctx.cards.get(survivor.id)).toMatchObject({
			templateOrd: 7,
			reps: 5,
			stability: 11,
		});
		expect(ctx.cards.get(untouched.id)).toMatchObject({
			templateOrd: 4,
			reps: 3,
			stability: 6,
		});
	});
	it("merging selected regions ignores a selection inside one card", () => {
		const definition = createDefinition();
		expect(mergeSelectedIORegions(definition, ["r4"])).toBe(definition);
		const grouped = mergeSelectedIORegions(definition, ["r4", "r7"]);
		expect(mergeSelectedIORegions(grouped, ["r4", "r7"])).toBe(grouped);
		expect(mergeSelectedIORegions(definition, ["missing"])).toBe(definition);
	});
	it("distinguishes separate notes on the same image without changing group ordinals", () => {
		const first = io.createImageOcclusionNote({
			imagePath: "Images/brain.png",
			definition: createDefinition(),
		});
		const second = io.createImageOcclusionNote({
			imagePath: "Images/brain.png",
			definition: createDefinition(),
		});
		const one = ctx.cards.get(first.cards[0].id),
			two = ctx.cards.get(second.cards[0].id);
		expect(one?.question).toContain("brain.png");
		expect(one?.question).not.toBe(two?.question);
		expect(one?.templateOrd).toBe(two?.templateOrd);
	});
	it("persists the optional solo mask setting without changing legacy definitions", () => {
		expect(
			parseIODefinition(serializeIODefinition(createDefinition()))
				?.hideOtherRegions,
		).toBe(true);
		const legacy = { ...createDefinition(), hideOtherRegions: undefined };
		expect(
			parseIODefinition(serializeIODefinition(legacy))?.hideOtherRegions,
		).toBeUndefined();
	});
});
