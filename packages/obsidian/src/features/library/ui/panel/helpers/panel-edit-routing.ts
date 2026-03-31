import {
	BUILTIN_IMAGE_OCCLUSION_ID,
	type Note,
	type NoteType,
} from "@true-recall/core/types/note.types";
import type { IOEditorMode } from "@true-recall/obsidian/features/image-occlusion/types";

interface PanelEditRoutingParams {
	note: Note;
	noteType: NoteType;
	openImageOcclusionEditor: (mode: IOEditorMode) => Promise<unknown>;
	openQuickEditor: () => Promise<unknown>;
}

export async function openPanelCardEditor({
	note,
	noteType,
	openImageOcclusionEditor,
	openQuickEditor,
}: PanelEditRoutingParams): Promise<void> {
	if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
		await openImageOcclusionEditor({
			mode: "edit",
			noteId: note.id,
			note,
		});
		return;
	}

	await openQuickEditor();
}
