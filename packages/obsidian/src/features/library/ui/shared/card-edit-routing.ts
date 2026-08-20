import {
	BUILTIN_IMAGE_OCCLUSION_ID,
	type Note,
	type NoteType,
} from "@true-recall/core/types/note.types";

import type { CommandService } from "@true-recall/obsidian/commands";
import { UpdateNoteFieldsCommand } from "@true-recall/obsidian/commands/commands/card-update.cmd";

import type { IOEditorMode } from "@true-recall/plugins/image-occlusion";

interface CardEditRoutingParams {
	note: Note;
	noteType: NoteType;
	openImageOcclusionEditor: (
		mode: IOEditorMode,
	) => Promise<{ cancelled: boolean }>;
	openQuickEditor: () => Promise<{ cancelled: boolean }>;
	/** When provided, a saved edit registers an undo entry restoring the note's
	 * pre-edit fields — the same command the review view pushes for its modal
	 * edits (onto its session stack). */
	commandService?: CommandService | null;
}

export async function openCardEditor({
	note,
	noteType,
	openImageOcclusionEditor,
	openQuickEditor,
	commandService,
}: CardEditRoutingParams): Promise<void> {
	const previousFields = { ...note.fields };

	const result =
		noteType.id === BUILTIN_IMAGE_OCCLUSION_ID
			? await openImageOcclusionEditor({
					mode: "edit",
					noteId: note.id,
					note,
				})
			: await openQuickEditor();

	if (result?.cancelled === false) {
		await commandService?.execute(
			new UpdateNoteFieldsCommand(note.id, previousFields, "Edit card"),
		);
	}
}

/** Store reads needed to go from a card id to the note behind it. */
export interface CardEditLookup {
	getNoteInfoForCardIds: (
		cardIds: string[],
	) => Array<{ noteId: string; noteTypeId: string }>;
	getNoteById: (noteId: string) => Note | null;
	getNoteTypeById: (noteTypeId: string) => NoteType | null;
}

export type CardEditTarget =
	| { ok: true; note: Note; noteType: NoteType }
	| { ok: false; error: string };

/**
 * Resolve the note and note type a card belongs to, so callers that only hold a
 * card id (browser rows, previews) can open the same editor as the panel.
 */
export function resolveCardEditTarget(
	cardId: string,
	lookup: CardEditLookup,
): CardEditTarget {
	const noteInfo = lookup.getNoteInfoForCardIds([cardId])[0];
	if (!noteInfo) {
		return {
			ok: false,
			error:
				"Cannot edit card: missing note link. Please restart Obsidian to complete database migration.",
		};
	}

	const note = lookup.getNoteById(noteInfo.noteId);
	if (!note) return { ok: false, error: "Note not found" };

	const noteType = lookup.getNoteTypeById(note.noteTypeId);
	if (!noteType) return { ok: false, error: "Note type not found" };

	return { ok: true, note, noteType };
}
