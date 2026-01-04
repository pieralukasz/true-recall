/**
 * Flashcard-related types
 */

// Single flashcard with question and answer
export interface FlashcardItem {
    question: string;
    answer: string;
    lineNumber: number; // Line number in the flashcard file (for editing)
    /** Block ID (UUID) for the flashcard, if present */
    id?: string;
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
    originalLineNumber?: number; // For MODIFIED/DELETED - line number of original
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
    /** Whether this flashcard file contains temporary cards (from Literature Notes) */
    isTemporary?: boolean;
}
