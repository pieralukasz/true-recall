/**
 * Card Generation Service
 *
 * Given a note and its note type, determines which cards to generate.
 * Handles standard (1 card per template), reversed (2 cards), cloze (1 per index),
 * and image-occlusion (1 per region) note types.
 */
import type { Note, NoteType } from "../../types/note.types";
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
/**
 * Generate cards for a note based on its note type.
 * Skips template ordinals that already exist (for incremental generation).
 */
export declare function generateCardsForNote(note: Note, noteType: NoteType, existingTemplateOrds?: number[]): GeneratedCard[];
/**
 * Detect which templates would produce empty front-side cards for the given note.
 * Returns info about templates whose rendered qfmt is empty.
 */
export declare function detectEmptyCards(note: Note, noteType: NoteType): EmptyCardInfo[];
