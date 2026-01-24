/**
 * FSRS Card Types
 * Core data structures for flashcard FSRS metadata
 */

import { State, Rating, type Card, type Grade } from "ts-fsrs";

// Re-export ts-fsrs types for convenience
export { State, Rating };
export type { Grade };
export type { Card as FSRSCard };

/**
 * Single review log entry stored per-card for FSRS optimization
 * Compact format: ~50 bytes per entry
 */
export interface CardReviewLogEntry {
    /** Timestamp of review (Unix ms) */
    t: number;
    /** Rating: 1=Again, 2=Hard, 3=Good, 4=Easy */
    r: Grade;
    /** Scheduled days at time of review */
    s: number;
    /** Elapsed days since last review */
    e: number;
}

/**
 * FSRS metadata stored in SQLite
 * Table: cards in .episteme/episteme.db
 */
export interface FSRSCardData {
    /** Unique card ID (UUID) */
    id: string;
    /** Next review date (ISO string) */
    due: string;
    /** Memory stability (days) */
    stability: number;
    /** Card difficulty (1-10, 1=easy, 10=hard) */
    difficulty: number;
    /** Review count */
    reps: number;
    /** Lapse count */
    lapses: number;
    /** Card state: 0=New, 1=Learning, 2=Review, 3=Relearning */
    state: State;
    /** Last review date (ISO string or null) */
    lastReview: string | null;
    /** Scheduled days until next review */
    scheduledDays: number;
    /** Current learning step (for Learning/Relearning) */
    learningStep: number;
    /** Is card suspended (excluded from review) */
    suspended?: boolean;
    /** Date until card is buried (ISO string) - auto-unbury after this date */
    buriedUntil?: string;
    /** Review history for FSRS optimization (last 20 reviews, optional) */
    history?: CardReviewLogEntry[];
    /** Card creation timestamp (Unix ms, optional for backwards compatibility) */
    createdAt?: number;
    /** Last update timestamp (Unix ms, for sync LWW comparison) */
    updatedAt?: number;

    // === SQL-based storage fields (schema v2) ===

    /** Card question (Markdown) - stored in SQL */
    question?: string;
    /** Card answer (Markdown) - stored in SQL */
    answer?: string;
    /** Source note UID (8-char hex) - link to MD note */
    sourceUid?: string;
    /** Source note name (from JOIN source_notes) */
    sourceNoteName?: string;
    /** Source note path (from JOIN source_notes, for link resolution) */
    sourceNotePath?: string;
    /** Projects associated with this card (via JOIN note_projects/projects) */
    projects?: string[];
}

/**
 * Source note information
 * Stored in source_notes table
 */
export interface SourceNoteInfo {
    /** Unique identifier (8-char hex, equals flashcard_uid in note) */
    uid: string;
    /** Note name (basename without extension) */
    noteName: string;
    /** Path to note file (may change on rename) */
    notePath?: string;
    /** Projects associated with this note (populated via JOIN, optional) */
    projects?: string[];
    /** Creation timestamp */
    createdAt?: number;
    /** Last update timestamp */
    updatedAt?: number;
}

/**
 * Extended flashcard with FSRS data
 * Used in UI (ReviewView, FlashcardPanel)
 */
export interface FSRSFlashcardItem {
    /** Unique ID (from FSRSCardData) */
    id: string;
    /** Question */
    question: string;
    /** Answer */
    answer: string;
    /** Path to flashcard file. Empty string "" when card is SQL-only (no MD file) */
    filePath: string;
    /** FSRS data */
    fsrs: FSRSCardData;
    /** Projects associated with this card (many-to-many via source note) */
    projects: string[];
    /** Original source note name (from frontmatter source_link) */
    sourceNoteName?: string;
    /** Source note UID (for MD note association) */
    sourceUid?: string;
    /** Path to source note (for markdown link resolution when filePath is empty) */
    sourceNotePath?: string;
}
