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

// Single flashcard with question and answer
export interface FlashcardItem {
    question: string;
    answer: string;
    /** Block ID (UUID) for the flashcard - required, every card has a unique identifier */
    id: string;
}

// Type of flashcard change
export type FlashcardChangeType = "NEW" | "MODIFIED" | "DELETED";

// Represents a proposed change (new, modified, or deleted flashcard)
export interface FlashcardChange {
    type: FlashcardChangeType;
    question: string;
    answer: string;
    originalQuestion?: string; // For MODIFIED/DELETED - exact match from existing
    originalAnswer?: string;   // For MODIFIED/DELETED - filled from existing flashcards
    originalCardId?: string;   // For MODIFIED/DELETED - card UUID of original
    reason?: string;           // For DELETED - reason for deletion
    accepted: boolean;         // UI state for accept/reject
}

// Result of diff generation
export interface DiffResult {
    changes: FlashcardChange[];
    existingFlashcards: FlashcardItem[]; // All existing flashcards for reference
}

// Flashcard file data structure
export interface FlashcardInfo {
    exists: boolean;
    filePath: string;
    cardCount: number;
    questions: string[]; // Keep for backwards compatibility (blocklist)
    flashcards: FlashcardItem[]; // Full Q&A pairs
    lastModified: number | null;
}
