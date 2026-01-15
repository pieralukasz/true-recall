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
	| "custom-session:selected";

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
	deck?: string;
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
 * Emitted for bulk operations (e.g., applying diff changes)
 */
export interface BulkChangeEvent extends FlashcardEvent {
	type: "cards:bulk-change";
	action: "added" | "removed" | "updated";
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
 * Union type for all events
 */
export type AnyFlashcardEvent =
	| CardAddedEvent
	| CardUpdatedEvent
	| CardRemovedEvent
	| CardReviewedEvent
	| BulkChangeEvent
	| StoreSyncedEvent
	| CustomSessionSelectedEvent;

/**
 * Event listener callback type
 */
export type FlashcardEventListener<
	T extends FlashcardEvent = AnyFlashcardEvent,
> = (event: T) => void;

/**
 * Result of custom session selection
 * Re-used from CustomSessionModal
 */
export interface CustomSessionResult {
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
 * Emitted when user makes a selection in custom session view
 */
export interface CustomSessionSelectedEvent extends FlashcardEvent {
	type: "custom-session:selected";
	result: CustomSessionResult;
}
