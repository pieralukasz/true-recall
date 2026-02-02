/**
 * Note flashcard type based on tags:
 * - permanent: #mind/zettel, #input/* - create flashcards
 * - maybe: #mind/application, #mind/protocol - flashcards optional
 * - none: #mind/question, #mind/hub, #mind/structure, #mind/index, #mind/person - no flashcards
 * - unknown: no recognized tags
 */
export type NoteFlashcardType = "permanent" | "maybe" | "none" | "unknown";

/**
 * AI-generated flashcard type:
 * - verify: Binary validation (True/False, Spot the Error) - fast fact-checking
 * - application: Scenario-based, procedural "how-to" cards - skill transfer
 * - question: Open-ended recall, "define X", "why Y" - conceptual understanding
 */
export type GeneratedNoteType = "verify" | "application" | "question";

export interface FlashcardItem {
    question: string;
    answer: string;
    id: string;
}

export interface FlashcardInfo {
    exists: boolean;
    cardCount: number;
    questions: string[];
    flashcards: FlashcardItem[];
    lastModified: number | null;
    sourceUid?: string;
}
