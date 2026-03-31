import type { CardType } from "./fsrs/card.types";

export interface FlashcardItem {
	question: string;
	answer: string;
	id: string;
	cardType?: CardType;
	clozeTemplate?: string;
	clozeIndex?: number;
	reverseOfBatchId?: string;
	sourceText?: string;
	alwaysTypeIn?: boolean;
	noteId?: string;
}

export interface FlashcardInfo {
	exists: boolean;
	cardCount: number;
	questions: string[];
	flashcards: FlashcardItem[];
	lastModified: number | null;
	sourceUid?: string;
}
