export interface CardChanges {
	question?: boolean;
	answer?: boolean;
	fsrs?: boolean;
	suspended?: boolean;
	buried?: boolean;
	sourceUid?: boolean;
	userComment?: boolean;
	alwaysTypeIn?: boolean;
}

export interface DomainEventMap {
	"card:added": { cardId: string; sourceNoteName?: string };
	"card:updated": { cardId: string; changes: CardChanges };
	"card:removed": { cardId: string; cardIds: string[] };
	"card:reviewed": { cardId: string; rating: number; newState: number };
	/**
	 * A review answered in the review view was saved. That path writes with
	 * `skipNotification` and never emits `card:reviewed`, which would rebuild
	 * the running session; listeners that only need to know a review landed
	 * (child cards) use this one.
	 */
	"review:recorded": { cardId: string; rating: number };
	"cards:bulk": { cardIds: string[]; action?: string };

	"note:changed": { sourceUid: string };
	"note:deleted": { path: string; sourceUid?: string };

	"hierarchy:changed": Record<string, never>;

	"settings:changed": { keys?: string[] };

	"store:ready": Record<string, never>;
	"store:shutdown": Record<string, never>;
}

export type DomainEventType = keyof DomainEventMap;
