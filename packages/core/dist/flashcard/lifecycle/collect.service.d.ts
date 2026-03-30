/**
 * Scans note content for block-format flashcards (#type/<slug> blocks).
 * Returns parsed blocks ready for createNote/createNoteBatch.
 */
import { type NoteTypeLookup, type ParsedBlock } from "@true-recall/core/flashcard/parsing/block-parser.service";
export interface CollectResult {
    collectedCount: number;
    parsedBlocks: ParsedBlock[];
    /** Original content unchanged */
    newContent: string;
    /** Content with block-format flashcards removed */
    newContentWithoutFlashcards: string;
}
export declare class CollectService {
    private getNoteType;
    constructor(getNoteType: NoteTypeLookup);
    collect(content: string): CollectResult;
    countFlashcardLines(content: string): number;
}
