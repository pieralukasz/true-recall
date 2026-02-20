/**
 * Orphaned Cards Service
 * Handles detection and management of orphaned cards
 *
 * Orphaned cards are flashcards that either:
 * 1. Don't have a source_uid (no_source_uid)
 * 2. Have a source_uid that doesn't match any existing file (missing_source_file)
 */

import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import type { FSRSCardData, FSRSFlashcardItem } from "@shared/types";

export type OrphanReason = "no_source_uid" | "missing_source_file";

export interface OrphanedCardInfo extends FSRSFlashcardItem {
	orphanReason: OrphanReason;
	missingSourceUid?: string;
}

export interface OrphanedCardGroup {
	groupKey: string;
	displayName: string;
	cards: OrphanedCardInfo[];
	reason: OrphanReason;
}

export class OrphanedCardsService {
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

	isOrphaned(card: FSRSCardData | FSRSFlashcardItem): boolean {
		if ("sourceUid" in card) {
			return !card.sourceUid;
		}
		return !card.sourceUid;
	}

	countOrphanedCards(store: SqliteStoreService): number {
		return this.getOrphanedCards(store).length;
	}

	getOrphanedCardIds(store: SqliteStoreService): string[] {
		return this.getOrphanedCards(store).map((card) => card.id);
	}

	/**
	 * Detects both cards with no source_uid and cards with source_uid
	 * pointing to non-existent files
	 */
	getOrphanedCardsExtended(
		store: SqliteStoreService,
		frontmatterIndex: FrontmatterIndexService,
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
					card.sourceUid,
				);
				if (!sourceFile) {
					// Type 2: Missing source file
					orphans.push(
						this.cardToOrphanInfo(card, "missing_source_file", card.sourceUid),
					);
				}
			}
		}

		return orphans;
	}

	/**
	 * Cards from the same deleted note will be grouped together
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
			reason:
				groupKey === "no_source_uid" ? "no_source_uid" : "missing_source_file",
		}));
	}

	countOrphanedCardsExtended(
		store: SqliteStoreService,
		frontmatterIndex: FrontmatterIndexService,
	): number {
		return this.getOrphanedCardsExtended(store, frontmatterIndex).length;
	}

	private cardToOrphanInfo(
		card: FSRSCardData,
		reason: OrphanReason,
		missingSourceUid?: string,
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
