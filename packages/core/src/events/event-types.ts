export interface CardChanges {
	question?: boolean;
	answer?: boolean;
	fsrs?: boolean;
	suspended?: boolean;
	buried?: boolean;
	sourceUid?: boolean;
}

export interface DomainEventMap {
	"card:added": { cardId: string; sourceNoteName?: string };
	"card:updated": { cardId: string; changes: CardChanges };
	"card:removed": { cardId: string; cardIds: string[] };
	"card:reviewed": { cardId: string; rating: number; newState: number };
	"cards:bulk": { cardIds: string[]; action?: string };

	"note:changed": { sourceUid: string };
	"note:deleted": { path: string; sourceUid?: string };

	"hierarchy:changed": Record<string, never>;

	"settings:changed": { keys?: string[] };

	"store:ready": Record<string, never>;
	"store:shutdown": Record<string, never>;
}

export type DomainEventType = keyof DomainEventMap;
