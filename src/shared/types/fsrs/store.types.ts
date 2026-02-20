import type { FSRSCardData } from "@shared/types/fsrs/card.types";

export interface CardStore {
	isReady(): boolean;
	get(cardId: string): FSRSCardData | undefined;
	set(cardId: string, data: FSRSCardData): void;
	delete(cardId: string): void;
	has(cardId: string): boolean;
	keys(): string[];
	getAll(): FSRSCardData[];
	size(): number;
	load(): Promise<void>;
	flush(): Promise<void>;
	saveNow(): Promise<boolean>;

	// === Schema v2 methods (optional - for SQL storage) ===
	hasAnyCardContent?(): boolean;
	getCardsWithContent?(): FSRSCardData[];
	updateCardContent?(cardId: string, question: string, answer: string): void;
	getCardsBySourceUid?(sourceUid: string): FSRSCardData[];
}
