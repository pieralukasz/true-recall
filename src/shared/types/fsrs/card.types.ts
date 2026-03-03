/**
 * FSRS Card Types
 * Core data structures for flashcard FSRS metadata
 */

import { type Card, type Grade, Rating, State } from "ts-fsrs";

// Re-export ts-fsrs types for convenience
export { State, Rating };
export type { Grade };
export type { Card as FSRSCard };

export type CardType = "basic" | "cloze" | "reversed" | "image-occlusion";

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

	// === SQL-based storage fields (schema v2) ===

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
	// === Card type fields (schema v21) ===

	/** Card type: 'basic' (default), 'cloze', or 'reversed' */
	cardType?: CardType;
	/** For cloze cards: original template with {{cN::...}} syntax */
	clozeTemplate?: string;
	/** For cloze cards: which cloze number this card tests */
	clozeIndex?: number;
	/** For reversed cards: ID of the original card this is the reverse of */
	reverseOf?: string;

	// === Creation source tracking (schema v24) ===

	/** How the card was created: 'manual', 'ai', or 'anki_import' */
	createdVia?: string;

	// === Image occlusion fields (schema v23) ===

	/** Vault-relative path to the source image */
	ioImagePath?: string;
	/** JSON-serialized IODefinition (regions + maskMode) */
	ioRegionsJson?: string;
	/** Which mask group this child card tests */
	ioGroupKey?: string;
	/** Parent card ID (for IO child cards) */
	ioParentId?: string;

	// === Source text linking (schema v25) ===

	/** Original selected text that generated this card (for jump-to-source) */
	sourceText?: string;

	// === Note-based architecture fields (schema v26) ===

	/** Note ID (links card to its note for template rendering) */
	noteId?: string;
	/** Template ordinal (which template of the note type this card uses) */
	templateOrd?: number;
	/** Note type ID (for deriving card type and template) */
	noteTypeId?: string;
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
	/** FSRS data */
	fsrs: FSRSCardData;
	/** Source note name (resolved from vault at runtime via sourceUid) */
	sourceNoteName?: string;
	/** Source note UID (for MD note association) */
	sourceUid?: string;
	/** Path to source note (resolved from vault at runtime via sourceUid) */
	sourceNotePath?: string;
	/** Card type: 'basic' (default), 'cloze', or 'reversed' */
	cardType?: CardType;
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
	/** Note ID (v26: links card to its note) */
	noteId?: string;
	/** Template ordinal (v26: which template this card uses) */
	templateOrd?: number;
}
