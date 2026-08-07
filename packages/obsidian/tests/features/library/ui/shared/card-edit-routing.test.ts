import { describe, expect, it, vi } from "vitest";

import {
	BUILTIN_BASIC_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
	type Note,
	type NoteType,
} from "@true-recall/core/types/note.types";

import {
	type CardEditLookup,
	openCardEditor,
	resolveCardEditTarget,
} from "../../../../../src/features/library/ui/shared/card-edit-routing";

function makeNoteType(id: string): NoteType {
	return {
		id,
		name: id,
		type: 0,
		fields: ["Front", "Back"],
		templates: [
			{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
		],
		css: "",
		isBuiltin: false,
	};
}

function makeNote(id: string, noteTypeId: string): Note {
	return {
		id,
		noteTypeId,
		fields: { Front: "Q", Back: "A" },
		tags: [],
	};
}

function makeLookup(overrides: Partial<CardEditLookup> = {}): CardEditLookup {
	return {
		getNoteInfoForCardIds: () => [
			{ noteId: "note-1", noteTypeId: BUILTIN_BASIC_ID },
		],
		getNoteById: () => makeNote("note-1", BUILTIN_BASIC_ID),
		getNoteTypeById: () => makeNoteType(BUILTIN_BASIC_ID),
		...overrides,
	};
}

describe("openCardEditor", () => {
	it("routes image occlusion note types to image occlusion editor", async () => {
		const openImageOcclusionEditor = vi.fn(async () => ({}));
		const openQuickEditor = vi.fn(async () => ({}));

		await openCardEditor({
			note: {
				id: "note-1",
				noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
				fields: { Image: "img.png", Regions: "[]" },
				tags: [],
			},
			noteType: makeNoteType(BUILTIN_IMAGE_OCCLUSION_ID),
			openImageOcclusionEditor,
			openQuickEditor,
		});

		expect(openImageOcclusionEditor).toHaveBeenCalledOnce();
		expect(openQuickEditor).not.toHaveBeenCalled();
	});

	it("routes non-image note types to quick editor", async () => {
		const openImageOcclusionEditor = vi.fn(async () => ({}));
		const openQuickEditor = vi.fn(async () => ({}));

		await openCardEditor({
			note: makeNote("note-2", BUILTIN_BASIC_ID),
			noteType: makeNoteType(BUILTIN_BASIC_ID),
			openImageOcclusionEditor,
			openQuickEditor,
		});

		expect(openQuickEditor).toHaveBeenCalledOnce();
		expect(openImageOcclusionEditor).not.toHaveBeenCalled();
	});
});

describe("resolveCardEditTarget", () => {
	it("resolves the note and note type behind a card id", () => {
		const getNoteInfoForCardIds = vi.fn(() => [
			{ noteId: "note-1", noteTypeId: BUILTIN_BASIC_ID },
		]);

		const target = resolveCardEditTarget(
			"card-1",
			makeLookup({ getNoteInfoForCardIds }),
		);

		expect(getNoteInfoForCardIds).toHaveBeenCalledWith(["card-1"]);
		expect(target.ok).toBe(true);
		if (!target.ok) return;
		expect(target.note.id).toBe("note-1");
		expect(target.noteType.id).toBe(BUILTIN_BASIC_ID);
	});

	it("fails when the card has no note link", () => {
		const target = resolveCardEditTarget(
			"card-1",
			makeLookup({ getNoteInfoForCardIds: () => [] }),
		);

		expect(target.ok).toBe(false);
		if (target.ok) return;
		expect(target.error).toContain("missing note link");
	});

	it("fails when the note is missing", () => {
		const target = resolveCardEditTarget(
			"card-1",
			makeLookup({ getNoteById: () => null }),
		);

		expect(target).toEqual({ ok: false, error: "Note not found" });
	});

	it("fails when the note type is missing", () => {
		const target = resolveCardEditTarget(
			"card-1",
			makeLookup({ getNoteTypeById: () => null }),
		);

		expect(target).toEqual({ ok: false, error: "Note type not found" });
	});
});
