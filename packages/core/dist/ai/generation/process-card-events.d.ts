import type { FlashcardItem } from "../../types/flashcard.types";
import type { IncrementalFlashcardParser } from "../parsing/incremental-flashcard-parser";
type ParserEvents = ReturnType<IncrementalFlashcardParser["feed"]>;
/** Minimal file reference needed by process-card-events (replaces Obsidian TFile). */
export interface SourceFileRef {
    path: string;
}
/** Minimal subset of FlashcardManager used during card event processing. */
export interface CardEventFlashcardManager {
    getFrontmatterService(): {
        getSourceNoteUid(file: SourceFileRef): Promise<string | undefined | null>;
        generateUid(): string;
        setSourceNoteUid(file: SourceFileRef, uid: string): Promise<void>;
    };
    createNote(params: {
        noteTypeId: string;
        fields: Record<string, string>;
        alwaysTypeIn?: boolean;
        sourceUid: string;
        sourceText?: string;
        createdVia: string;
    }): {
        cards: FlashcardItem[];
    };
}
export declare function processCardEvents(events: ParserEvents, sourceFile: SourceFileRef, flashcardManager: CardEventFlashcardManager, onPartial: (q: string | null, a: string | null) => void, onCount: (created: number, dups: number) => void, inputText?: string): Promise<void>;
export {};
