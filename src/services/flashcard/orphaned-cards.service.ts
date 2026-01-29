/**
 * Orphaned Cards Service
 * Handles detection and management of orphaned cards
 *
 * Orphaned cards are flashcards that either:
 * 1. Don't have a source_uid (no_source_uid)
 * 2. Have a source_uid that doesn't match any existing file (missing_source_file)
 */
import type { FSRSCardData, FSRSFlashcardItem } from "../../types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "../core/frontmatter-index.service";

/**
 * Reason why a card is orphaned
 */
export type OrphanReason = "no_source_uid" | "missing_source_file";

/**
 * Extended orphaned card info with reason
 */
export interface OrphanedCardInfo extends FSRSFlashcardItem {
	orphanReason: OrphanReason;
	/** The source_uid that doesn't match any file (for missing_source_file) */
	missingSourceUid?: string;
}

/**
 * Group of orphaned cards from the same deleted note
 */
export interface OrphanedCardGroup {
	/** The source_uid (or "no_source_uid" for cards without one) */
	groupKey: string;
	/** Display name for the group */
	displayName: string;
	/** Cards in this group */
	cards: OrphanedCardInfo[];
	/** Reason for orphaning */
	reason: OrphanReason;
}

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

	/**
	 * Get all orphaned cards with detailed reason
	 * Detects both:
	 * 1. Cards with no source_uid
	 * 2. Cards with source_uid pointing to non-existent files
	 *
	 * @param store - The card store
	 * @param frontmatterIndex - The frontmatter index for file lookup
	 * @returns Array of orphaned cards with reason
	 */
	getOrphanedCardsExtended(
		store: SqliteStoreService,
		frontmatterIndex: FrontmatterIndexService
	): OrphanedCardInfo[] {
		const allCards = store.cards.getAll();
		const orphans: OrphanedCardInfo[] = [];

		for (const card of allCards) {
			if (!card.sourceUid) {
				// Type 1: No source_uid
				orphans.push(this.cardToOrphanInfo(card, "no_source_uid"));
			} else {
				// Check if source file exists
				const sourceFile = frontmatterIndex.getFileByValue(
					"flashcard_uid",
					card.sourceUid
				);
				if (!sourceFile) {
					// Type 2: Missing source file
					orphans.push(
						this.cardToOrphanInfo(card, "missing_source_file", card.sourceUid)
					);
				}
			}
		}

		return orphans;
	}

	/**
	 * Group orphaned cards by their source_uid
	 * Cards from the same deleted note will be grouped together
	 *
	 * @param orphans - Array of orphaned cards
	 * @returns Array of groups
	 */
	groupOrphanedCards(orphans: OrphanedCardInfo[]): OrphanedCardGroup[] {
		const groups = new Map<string, OrphanedCardInfo[]>();

		for (const orphan of orphans) {
			const key = orphan.missingSourceUid ?? "no_source_uid";
			const existing = groups.get(key) ?? [];
			existing.push(orphan);
			groups.set(key, existing);
		}

		return Array.from(groups.entries()).map(([groupKey, cards]) => ({
			groupKey,
			displayName:
				groupKey === "no_source_uid"
					? "Cards without source note"
					: `Deleted note (${groupKey})`,
			cards,
			reason: groupKey === "no_source_uid" ? "no_source_uid" : "missing_source_file",
		}));
	}

	/**
	 * Count all orphaned cards (extended)
	 */
	countOrphanedCardsExtended(
		store: SqliteStoreService,
		frontmatterIndex: FrontmatterIndexService
	): number {
		return this.getOrphanedCardsExtended(store, frontmatterIndex).length;
	}

	/**
	 * Convert FSRSCardData to OrphanedCardInfo
	 */
	private cardToOrphanInfo(
		card: FSRSCardData,
		reason: OrphanReason,
		missingSourceUid?: string
	): OrphanedCardInfo {
		return {
			id: card.id,
			question: card.question ?? "",
			answer: card.answer ?? "",
			fsrs: card,
			projects: card.projects ?? [],
			sourceUid: card.sourceUid,
			sourceNoteName: undefined,
			sourceNotePath: undefined,
			orphanReason: reason,
			missingSourceUid,
		};
	}
}
