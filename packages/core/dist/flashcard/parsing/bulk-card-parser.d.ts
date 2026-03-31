/**
 * Designed for the Quick tab in the Add Flashcards modal: users paste
 * text or type it manually.
 *
 * Format: `Front :: Back` (one pair per line, also catches standalone cloze).
 *
 * When `ParseOptions.noteType` is provided (Import Studio mode):
 * - NoteType fields are used as column names for tab-separated parsing
 * - 2-field NoteTypes also support :: format as fallback
 * - Cloze auto-detection is restricted to noteType.type === 1
 */
import { type NoteTypeLookup } from "./block-parser.service";
import type { NoteType } from "@true-recall/core/types/note.types";
export interface ParsedCard {
    noteTypeId: string;
    fields: Record<string, string>;
    alwaysTypeIn?: boolean;
}
export interface BulkParseResult {
    cards: ParsedCard[];
    detectedFormat: "block" | "tab" | "double-colon" | "none";
}
export interface ParseOptions {
    /**
     * When provided, the parser maps columns to this NoteType's field names
     * and restricts cloze auto-detection to cloze NoteTypes (type === 1).
     */
    noteType?: NoteType;
    /** Required for block format parsing (#type/<slug>) */
    getNoteType?: NoteTypeLookup;
}
export declare function parseBulkText(text: string, options?: ParseOptions): BulkParseResult;
