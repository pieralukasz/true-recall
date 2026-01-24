/**
 * Orphaned Cards Service
 * Handles detection and management of orphaned cards
 *
 * Orphaned cards are flashcards that don't have a source_uid,
 * meaning they're not associated with any source note.
 */
import type { FSRSCardData, FSRSFlashcardItem } from "../../types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";

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
	getOrphanedCards(store: SqliteStoreService): FSRSFlashcardItem[] {
		const cards = store.getOrphanedCards();

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
	countOrphanedCards(store: SqliteStoreService): number {
		return this.getOrphanedCards(store).length;
	}

	/**
	 * Get orphaned card IDs
	 *
	 * @param store - The card store
	 * @returns Array of orphaned card IDs
	 */
	getOrphanedCardIds(store: SqliteStoreService): string[] {
		return this.getOrphanedCards(store).map((card) => card.id);
	}
}
