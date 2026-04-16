import type { FSRSCardData, IODefinition } from "@true-recall/core/types";
import type { Note } from "@true-recall/core/types/note.types";

export type { IODefinition, IORegion, IOShape } from "@true-recall/core/types";

export interface IOEditorAddMode {
	mode: "add";
	sourceUid?: string;
	imagePath?: string;
}

export interface IOEditorEditMode {
	mode: "edit";
	noteId: string;
	note: Note;
}

export type IOEditorMode = IOEditorAddMode | IOEditorEditMode;

export interface IOEditorResult {
	cancelled: boolean;
	imagePath?: string;
	definition?: IODefinition;
	createdNote?: Note;
	createdCards?: FSRSCardData[];
	updatedCardIds?: string[];
}
