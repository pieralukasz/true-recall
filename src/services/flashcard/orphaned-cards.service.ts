/**
 * Orphaned Cards Service
 * Handles detection and management of orphaned cards
 *
 * Orphaned cards are flashcards that don't have a source_uid,
 * meaning they're not associated with any source note.
 */
import type { CardStore, FSRSCardData, FSRSFlashcardItem } from "../../types";

/**
 * Service for managing orphaned cards
 */
export class OrphanedCardsService {
	/**
	 * Get all orphaned cards (cards without source_uid)
	 *
	 * @param store - The card store
	 * @returns Array of orphaned cards
	 */
	getOrphanedCards(store: CardStore): FSRSFlashcardItem[] {
		const sqlStore = store as CardStore & {
			getOrphanedCards?: () => FSRSCardData[];
		};

		const cards = sqlStore.getOrphanedCards?.() ?? [];

		// Convert FSRSCardData to FSRSFlashcardItem
		return cards.map((card) => ({
			id: card.id,
			question: card.question ?? "",
			answer: card.answer ?? "",
			fsrs: card,
			projects: card.projects ?? [],
			filePath: "",
			sourceUid: undefined,
			sourceNoteName: undefined,
			sourceNotePath: undefined,
		}));
	}

	/**
	 * Check if a card is orphaned
	 *
	 * @param card - The card to check
	 * @returns True if the card has no source_uid
	 */
	isOrphaned(card: FSRSCardData | FSRSFlashcardItem): boolean {
		if ("sourceUid" in card) {
			return !card.sourceUid;
		}
		return !card.sourceUid;
	}

	/**
	 * Count orphaned cards
	 *
	 * @param store - The card store
	 * @returns Number of orphaned cards
	 */
	countOrphanedCards(store: CardStore): number {
		return this.getOrphanedCards(store).length;
	}

	/**
	 * Get orphaned card IDs
	 *
	 * @param store - The card store
	 * @returns Array of orphaned card IDs
	 */
	getOrphanedCardIds(store: CardStore): string[] {
		return this.getOrphanedCards(store).map((card) => card.id);
	}
}
