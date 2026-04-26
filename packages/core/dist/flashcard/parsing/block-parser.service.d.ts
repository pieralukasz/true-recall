/**
 * Block Format Parser
 *
 * Parses the unified block format for all card types:
 *
 * #type/<slug>
 * Front: What is X?
 * Back: X is...
 * <!-- source: exact quote -->
 * ---
 *
 * Each block starts with #type/<slug>, contains FieldName: value pairs
 * (field names come from the NoteType), and ends at --- or EOF.
 */
import { type NoteType } from "@true-recall/core/types/note.types";
export interface ParsedBlock {
    noteTypeId: string;
    noteTypeSlug: string;
    fields: Record<string, string>;
    sourceText?: string;
    alwaysTypeIn?: boolean;
}
export type NoteTypeLookup = (slug: string) => NoteType | null;
/**
 * Parse content containing block-format flashcards.
 * Returns parsed blocks and content with blocks stripped.
 */
export declare function parseBlocks(content: string, getNoteType: NoteTypeLookup): {
    blocks: ParsedBlock[];
    contentWithoutBlocks: string;
};
export declare function blockToText(block: ParsedBlock, fieldNames: string[]): string;
export declare function blocksToText(blocks: ParsedBlock[], getFieldNames: (noteTypeId: string) => string[]): string;
/**
 * Count how many valid blocks exist in content.
 */
export declare function countBlocks(content: string, getNoteType: NoteTypeLookup): number;
