/**
 * Event Types for Cross-Component Reactivity
 *
 * These events enable automatic UI synchronization across views:
 * - When a card is modified in one view, others update automatically
 * - Services emit events, UI components subscribe
 */

/**
 * All possible event types
 */
export type FlashcardEventType =
	| "card:added"
	| "card:updated"
	| "card:removed"
	| "card:reviewed"
	| "cards:bulk-change"
	| "store:synced"
	| "session:selected"
	| "missing-flashcards:selected"
	| "sync:started"
	| "sync:completed"
	| "sync:failed"
	| "sync:progress";

/**
 * Base event interface
 */
export interface FlashcardEvent {
	type: FlashcardEventType;
	timestamp: number;
}

/**
 * Emitted when a new flashcard is created
 */
export interface CardAddedEvent extends FlashcardEvent {
	type: "card:added";
	cardId: string;
	filePath: string;
	projects?: string[];
	sourceNoteName?: string;
}

/**
 * Emitted when a flashcard's content or FSRS data changes
 */
export interface CardUpdatedEvent extends FlashcardEvent {
	type: "card:updated";
	cardId: string;
	filePath: string;
	changes: {
		question?: boolean;
		answer?: boolean;
		fsrs?: boolean;
		suspended?: boolean;
		buried?: boolean;
	};
}

/**
 * Emitted when a flashcard is deleted
 */
export interface CardRemovedEvent extends FlashcardEvent {
	type: "card:removed";
	cardId: string;
	filePath: string;
}

/**
 * Emitted when a card is graded during review
 */
export interface CardReviewedEvent extends FlashcardEvent {
	type: "card:reviewed";
	cardId: string;
	rating: number; // 1-4 (Again, Hard, Good, Easy)
	newState: number; // State enum from ts-fsrs
}

/**
 * Emitted for bulk operations (e.g., applying diff changes, browser operations)
 */
export interface BulkChangeEvent extends FlashcardEvent {
	type: "cards:bulk-change";
	action: "added" | "removed" | "updated" | "suspend" | "unsuspend" | "bury" | "unbury" | "delete" | "reset" | "reschedule";
	cardIds: string[];
	filePath?: string;
}

/**
 * Emitted after SQLite store syncs with disk
 */
export interface StoreSyncedEvent extends FlashcardEvent {
	type: "store:synced";
	merged: number;
	conflicts: number;
}

/**
 * Result of missing flashcards selection
 */
export interface MissingFlashcardsResult {
	cancelled: boolean;
	selectedNotePath: string | null;
}

/**
 * Emitted when user makes a selection in missing flashcards view
 */
export interface MissingFlashcardsSelectedEvent extends FlashcardEvent {
	type: "missing-flashcards:selected";
	result: MissingFlashcardsResult;
}

/**
 * Sync operation phases
 */
export type SyncPhase = "connecting" | "pulling" | "applying" | "pushing" | "finalizing";

/**
 * Emitted when sync operation starts
 */
export interface SyncStartedEvent extends FlashcardEvent {
	type: "sync:started";
	manual: boolean;
}

/**
 * Emitted when sync completes successfully
 */
export interface SyncCompletedEvent extends FlashcardEvent {
	type: "sync:completed";
	pulled: number;
	pushed: number;
	durationMs: number;
}

/**
 * Emitted when sync fails
 */
export interface SyncFailedEvent extends FlashcardEvent {
	type: "sync:failed";
	error: string;
	retryIn: number | null; // ms until next retry, null if no retry
	attempt: number;
}

/**
 * Emitted during sync for progress updates
 */
export interface SyncProgressEvent extends FlashcardEvent {
	type: "sync:progress";
	phase: SyncPhase;
	detail?: string;
}

/**
 * Union type for all events
 */
export type AnyFlashcardEvent =
	| CardAddedEvent
	| CardUpdatedEvent
	| CardRemovedEvent
	| CardReviewedEvent
	| BulkChangeEvent
	| StoreSyncedEvent
	| SessionSelectedEvent
	| MissingFlashcardsSelectedEvent
	| SyncStartedEvent
	| SyncCompletedEvent
	| SyncFailedEvent
	| SyncProgressEvent;

/**
 * Event listener callback type
 */
export type FlashcardEventListener<
	T extends FlashcardEvent = AnyFlashcardEvent,
> = (event: T) => void;

/**
 * Result of session selection
 * Re-used from SessionModal
 */
export interface SessionResult {
	cancelled: boolean;
	sessionType: "current-note" | "created-today" | "select-notes" | "state-filter" | "default" | null;
	sourceNoteFilter?: string;
	sourceNoteFilters?: string[];
	filePathFilter?: string;
	createdTodayOnly?: boolean;
	ignoreDailyLimits: boolean;
	useDefaultDeck?: boolean;
	bypassScheduling?: boolean;
	stateFilter?: "due" | "learning" | "new" | "buried";
}

/**
 * Emitted when user makes a selection in session view
 */
export interface SessionSelectedEvent extends FlashcardEvent {
	type: "session:selected";
	result: SessionResult;
}
