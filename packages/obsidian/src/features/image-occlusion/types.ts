import type { FSRSCardData } from "@shared/types";
import type { Note } from "@shared/types/note.types";

export type IOShape = "rect" | "ellipse";
export type IOMaskMode = "solo" | "all";

/** Normalized coordinates (0-1 range) for resolution independence */
export interface IORegion {
	id: string;
	/** Left edge, normalized 0-1 */
	x: number;
	/** Top edge, normalized 0-1 */
	y: number;
	/** Width, normalized 0-1 */
	w: number;
	/** Height, normalized 0-1 */
	h: number;
	groupKey: string;
	shape: IOShape;
	label?: string;
}

export interface IODefinition {
	regions: IORegion[];
	maskMode: IOMaskMode;
	version: 1;
}

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
