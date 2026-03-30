import type { ParsedBlock } from "../../flashcard/parsing/block-parser.service";
import type { NoteType } from "../../types/note.types";
export interface IncrementalParseEvent {
    type: "card_complete" | "partial_update";
    block?: ParsedBlock;
    partialQuestion?: string;
    partialAnswer?: string;
}
export type NoteTypeLookup = (slug: string) => NoteType | null;
/**
 * Non-streaming JSON parser: parse full AI response text into ParsedBlocks.
 * Handles markdown code fences and extracts the JSON array.
 */
export declare function parseBlockResponse(text: string, getNoteType: NoteTypeLookup): ParsedBlock[];
/**
 * Streaming JSON array parser.
 *
 * Extracts complete JSON objects from a streamed JSON array by tracking
 * brace depth and string state. Emits card_complete events as each
 * object is fully received, and partial_update events for in-progress objects.
 */
export declare class IncrementalFlashcardParser {
    private getNoteType;
    private objectBuffer;
    private state;
    private depth;
    private inString;
    private escaped;
    constructor(getNoteType: NoteTypeLookup);
    feed(chunk: string): IncrementalParseEvent[];
    finish(): IncrementalParseEvent[];
    private tryParseObject;
    private extractPartial;
}
