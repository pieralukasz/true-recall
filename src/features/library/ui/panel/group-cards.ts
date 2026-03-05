import type { FlashcardItem } from "@shared/types";

export interface PanelItem {
	card: FlashcardItem;
}

/**
 * Flat list — every card is its own row. No cloze/reverse grouping.
 */
export function groupCards(cards: FlashcardItem[]): PanelItem[] {
	return cards.map((card) => ({ card }));
}
