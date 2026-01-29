/**
 * Flashcard-related types
 */

/**
 * Note flashcard type based on tags
 * - permanent: #mind/zettel, #input/* - create flashcards
 * - maybe: #mind/application, #mind/protocol - flashcards optional
 * - none: #mind/question, #mind/hub, #mind/structure, #mind/index, #mind/person - no flashcards
 * - unknown: no recognized tags
 */
export type NoteFlashcardType = "permanent" | "maybe" | "none" | "unknown";

/**
 * Note type for AI-generated flashcard destination
 * - verify: Binary validation (True/False, Spot the Error) - fast fact-checking
 * - application: Scenario-based, procedural "how-to" cards - skill transfer
 * - question: Open-ended recall, "define X", "why Y" - conceptual understanding
 */
export type GeneratedNoteType = "verify" | "application" | "question";

// Single flashcard with question and answer
export interface FlashcardItem {
    question: string;
    answer: string;
    /** Block ID (UUID) for the flashcard - required, every card has a unique identifier */
    id: string;
}

// Flashcard file data structure
export interface FlashcardInfo {
    exists: boolean;
    cardCount: number;
    questions: string[]; // Keep for backwards compatibility (blocklist)
    flashcards: FlashcardItem[]; // Full Q&A pairs
    lastModified: number | null;
    sourceUid?: string;
}
