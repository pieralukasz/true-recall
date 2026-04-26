/**
 * FSRS Card Types
 * Core data structures for flashcard FSRS metadata
 */
import { type Card, type Grade, Rating, State } from "ts-fsrs";
export { State, Rating };
export type { Grade };
export type { Card as FSRSCard };
export type CardType = "basic" | "cloze" | "reversed" | "image-occlusion" | "note-review";
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
 * Table: cards in .true-recall/true-recall.db
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
    /** Card question (Markdown) - stored in SQL */
    question?: string;
    /** Card answer (Markdown) - stored in SQL */
    answer?: string;
    /** Source note UID (8-char hex) - link to MD note */
    sourceUid?: string;
    /** Source note name (resolved from vault at runtime via sourceUid) */
    sourceNoteName?: string;
    /** Source note path (resolved from vault at runtime via sourceUid) */
    sourceNotePath?: string;
    /** Card type: 'basic' (default), 'cloze', or 'reversed' */
    cardType?: CardType;
    /** For cloze cards: original template with {{cN::...}} syntax */
    clozeTemplate?: string;
    /** For cloze cards: which cloze number this card tests */
    clozeIndex?: number;
    /** For reversed cards: ID of the original card this is the reverse of */
    reverseOf?: string;
    /** How the card was created: 'manual', 'ai', or 'anki_import' */
    createdVia?: string;
    /** Vault-relative path to the source image */
    ioImagePath?: string;
    /** JSON-serialized IODefinition (regions + maskMode) */
    ioRegionsJson?: string;
    /** Which mask group this child card tests */
    ioGroupKey?: string;
    /** Parent card ID (for IO child cards) */
    ioParentId?: string;
    /** Original selected text that generated this card (for jump-to-source) */
    sourceText?: string;
    /** Note ID (links card to its note for template rendering) */
    noteId?: string;
    /** Template ordinal (which template of the note type this card uses) */
    templateOrd?: number;
    /** Note type ID (for deriving card type and template) */
    noteTypeId?: string;
    /** Note type name (resolved from JOIN at query time) */
    noteTypeName?: string;
    /** Force type-in mode for this card regardless of session default */
    alwaysTypeIn?: boolean;
    /** Custom field values for note creation (used by import to pass arbitrary fields to resolveNoteMapping) */
    fields?: Record<string, string>;
}
/**
 * Lightweight scheduling metadata — sufficient for queue building,
 * filtering, badge counting, and preset resolution.
 * No template rendering or content loading required.
 *
 * FSRSFlashcardItem extends this, so any function accepting
 * CardSchedulingMeta also accepts FSRSFlashcardItem.
 */
export interface CardSchedulingMeta {
    /** Unique ID (from FSRSCardData) */
    id: string;
    /** FSRS scheduling data */
    fsrs: FSRSCardData;
    /** Source note UID (for MD note association) */
    sourceUid?: string;
    /** Source note name (resolved from vault at runtime via sourceUid) */
    sourceNoteName?: string;
    /** Path to source note (resolved from vault at runtime via sourceUid) */
    sourceNotePath?: string;
    /** Card type: 'basic' (default), 'cloze', or 'reversed' */
    cardType?: CardType;
    /** Note ID (v26: links card to its note) */
    noteId?: string;
    /** Template ordinal (v26: which template this card uses) */
    templateOrd?: number;
    /** Note type name (resolved at query time) */
    noteTypeName?: string;
    /** Force type-in mode for this card regardless of session default */
    alwaysTypeIn?: boolean;
}
/**
 * Extended flashcard with rendered content.
 * Extends CardSchedulingMeta with template-rendered question/answer
 * and display-only fields. Loaded on demand for individual cards.
 */
export interface FSRSFlashcardItem extends CardSchedulingMeta {
    /** Question (rendered from template) */
    question: string;
    /** Answer (rendered from template) */
    answer: string;
    /** For cloze cards: original template with {{cN::...}} syntax */
    clozeTemplate?: string;
    /** For cloze cards: which cloze number this card tests */
    clozeIndex?: number;
    /** For reversed cards: ID of the original card this is the reverse of */
    reverseOf?: string;
    /** Vault-relative path to the source image (IO cards) */
    ioImagePath?: string;
    /** JSON-serialized IODefinition (IO cards) */
    ioRegionsJson?: string;
    /** Which mask group this child card tests (IO children) */
    ioGroupKey?: string;
    /** Parent card ID (IO children) */
    ioParentId?: string;
    /** Original selected text that generated this card (for jump-to-source) */
    sourceText?: string;
}
