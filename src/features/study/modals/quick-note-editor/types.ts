import type { FSRSCardData } from "@shared/types";
import type { Note, NoteType } from "@shared/types/note.types";

// ── Mode: discriminated union ──

export interface AddMode {
	mode: "add";
	sourceUid?: string;
	defaultNoteTypeId?: string;
}

export interface EditMode {
	mode: "edit";
	cardId: string;
	noteId: string;
	note: Note;
	noteType: NoteType;
}

export type QuickNoteEditorMode = AddMode | EditMode;

// ── Result ──

export interface QuickNoteEditorResult {
	cancelled: boolean;
	createdNote?: Note;
	createdCards?: FSRSCardData[];
	updatedCardIds?: string[];
}
