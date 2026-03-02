/**
 * Card Generation Service
 *
 * Given a note and its note type, determines which cards to generate.
 * Handles standard (1 card per template), reversed (2 cards), cloze (1 per index),
 * and image-occlusion (1 per region) note types.
 */

import type { Note, NoteType } from "@shared/types/note.types";

export interface GeneratedCard {
	id: string;
	noteId: string;
	templateOrd: number;
	sourceUid?: string;
}

export interface EmptyCardInfo {
	templateOrd: number;
	templateName: string;
}

export function generateCardsForNote(
	_note: Note,
	_noteType: NoteType,
	_existingTemplateOrds?: number[],
): GeneratedCard[] {
	throw new Error("Not implemented");
}

export function detectEmptyCards(
	_note: Note,
	_noteType: NoteType,
): EmptyCardInfo[] {
	throw new Error("Not implemented");
}
