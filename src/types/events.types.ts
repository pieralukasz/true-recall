/**
 * Events enable automatic UI synchronization across views.
 * Services emit events, UI components subscribe.
 */

export type FlashcardEventType =
	| "card:added"
	| "card:updated"
	| "card:removed"
	| "card:reviewed"
	| "cards:bulk-change"
	| "store:synced"
	| "session:selected"
	| "settings:changed";

export interface FlashcardEvent {
	type: FlashcardEventType;
	timestamp: number;
}

export interface CardAddedEvent extends FlashcardEvent {
	type: "card:added";
	cardId: string;
	sourceNoteName?: string;
}

export interface CardUpdatedEvent extends FlashcardEvent {
	type: "card:updated";
	cardId: string;
	changes: {
		question?: boolean;
		answer?: boolean;
		fsrs?: boolean;
		suspended?: boolean;
		buried?: boolean;
		sourceUid?: boolean;
	};
}

export interface CardRemovedEvent extends FlashcardEvent {
	type: "card:removed";
	cardId: string;
}

export interface CardReviewedEvent extends FlashcardEvent {
	type: "card:reviewed";
	cardId: string;
	rating: number; // 1-4 (Again, Hard, Good, Easy)
	newState: number; // State enum from ts-fsrs
}

export interface BulkChangeEvent extends FlashcardEvent {
	type: "cards:bulk-change";
	action: "added" | "removed" | "updated" | "suspend" | "unsuspend" | "bury" | "unbury" | "delete" | "reset" | "reschedule";
	cardIds: string[];
}

export interface StoreSyncedEvent extends FlashcardEvent {
	type: "store:synced";
	merged: number;
	conflicts: number;
}

export interface SettingsChangedEvent extends FlashcardEvent {
	type: "settings:changed";
	changedKeys?: string[];
}

export type AnyFlashcardEvent =
	| CardAddedEvent
	| CardUpdatedEvent
	| CardRemovedEvent
	| CardReviewedEvent
	| BulkChangeEvent
	| StoreSyncedEvent
	| SessionSelectedEvent
	| SettingsChangedEvent;

export type FlashcardEventListener<
	T extends FlashcardEvent = AnyFlashcardEvent,
> = (event: T) => void;

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

export interface SessionSelectedEvent extends FlashcardEvent {
	type: "session:selected";
	result: SessionResult;
}
