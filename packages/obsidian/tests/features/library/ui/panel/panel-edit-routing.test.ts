import {
	BUILTIN_BASIC_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
	type NoteType,
} from "@true-recall/core/types/note.types";
import { describe, expect, it, vi } from "vitest";
import { openPanelCardEditor } from "../../../../../src/features/library/ui/panel/helpers/panel-edit-routing";

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

describe("openPanelCardEditor", () => {
	it("routes image occlusion note types to image occlusion editor", async () => {
		const openImageOcclusionEditor = vi.fn(async () => ({}));
		const openQuickEditor = vi.fn(async () => ({}));

		await openPanelCardEditor({
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

		await openPanelCardEditor({
			note: {
				id: "note-2",
				noteTypeId: BUILTIN_BASIC_ID,
				fields: { Front: "Q", Back: "A" },
				tags: [],
			},
			noteType: makeNoteType(BUILTIN_BASIC_ID),
			openImageOcclusionEditor,
			openQuickEditor,
		});

		expect(openQuickEditor).toHaveBeenCalledOnce();
		expect(openImageOcclusionEditor).not.toHaveBeenCalled();
	});
});
