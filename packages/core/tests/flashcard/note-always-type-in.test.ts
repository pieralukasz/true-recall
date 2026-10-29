import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FLASHCARD_CONFIG } from "../../src/constants";
import { ImageOcclusionReconciler } from "../../src/flashcard/image-occlusion-reconciler";
import { NoteCreationService } from "../../src/flashcard/note-creation.service";
import { NoteMutationService } from "../../src/flashcard/note-mutation.service";
import type { SqliteStoreService } from "../../src/persistence/sqlite/SqliteStoreService";
import {
	createTestContext,
	type TestContext,
} from "../persistence/sqlite/__setup__/test-database";

describe("setNoteAlwaysTypeIn", () => {
	let ctx: TestContext;
	let creation: NoteCreationService;
	let mutation: NoteMutationService;
	let emit: ReturnType<typeof vi.fn>;
	beforeEach(async () => {
		ctx = await createTestContext();
		const store = {
			...ctx,
			get: ctx.cards.get.bind(ctx.cards),
			set: ctx.cards.set.bind(ctx.cards),
		} as unknown as SqliteStoreService;
		emit = vi.fn();
		creation = new NoteCreationService(() => store, vi.fn());
		const io = new ImageOcclusionReconciler(
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
			emit,
		);
	});
	afterEach(() => ctx.close());

	it("turns type-in on and off for an existing card, keeping other tags", () => {
		const { note, cards } = creation.createNote({
			noteTypeId: "builtin-basic",
			fields: { Front: "Q", Back: "A" },
		});
		ctx.notes.update(note.id, { tags: ["keep-me"] });
		const cardId = cards[0].id;
		expect(ctx.cards.get(cardId)?.alwaysTypeIn).toBe(false);

		expect(mutation.setNoteAlwaysTypeIn(note.id, true)).toEqual([cardId]);
		expect(ctx.cards.get(cardId)?.alwaysTypeIn).toBe(true);
		expect(ctx.notes.getById(note.id)?.tags).toEqual([
			"keep-me",
			FLASHCARD_CONFIG.alwaysTypeInTag,
		]);
		expect(emit).toHaveBeenCalledWith("card:updated", {
			cardId,
			changes: { alwaysTypeIn: true },
		});

		mutation.setNoteAlwaysTypeIn(note.id, false);
		expect(ctx.cards.get(cardId)?.alwaysTypeIn).toBe(false);
		expect(ctx.notes.getById(note.id)?.tags).toEqual(["keep-me"]);
	});

	it("is a no-op when the flag already matches", () => {
		const { note } = creation.createNote({
			noteTypeId: "builtin-basic",
			fields: { Front: "Q", Back: "A" },
			alwaysTypeIn: true,
		});
		emit.mockClear();
		expect(mutation.setNoteAlwaysTypeIn(note.id, true)).toEqual([]);
		expect(emit).not.toHaveBeenCalled();
	});
});
