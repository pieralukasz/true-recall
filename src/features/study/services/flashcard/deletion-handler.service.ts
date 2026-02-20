/**
 * Deletion Handler Service
 * Handles file deletion and manages orphaned cards
 *
 * When a note with flashcards is deleted, this service:
 * 1. Detects the deletion via vault.on('delete')
 * 2. Retrieves the associated flashcards
 * 3. Shows a modal asking what to do with them
 */
import type { App, TFile } from "obsidian";
import type { FSRSCardData } from "../../../../shared/types";
import type { FrontmatterIndexService } from "../../../../features/core/services/frontmatter-index.service";
import type { SqliteStoreService } from "../../../../features/core/persistence/sqlite/SqliteStoreService";
import {
	type OrphanedCardInfo,
	OrphanedCardsService,
} from "../../../library/services/orphaned-cards.service";

export interface DeletionHandlerDeps {
	app: App;
	frontmatterIndex: FrontmatterIndexService;
	store: SqliteStoreService;
	onOrphanedCards: (context: OrphanedCardsContext) => Promise<void>;
}

export interface OrphanedCardsContext {
	cards: FSRSCardData[];
	deletedNoteName: string;
	deletedNotePath: string;
	sourceUid: string;
}

/**
 * Service for handling file deletion and orphaned cards
 */
export class DeletionHandlerService {
	private deps: DeletionHandlerDeps;
	private orphanedCardsService: OrphanedCardsService;

	constructor(deps: DeletionHandlerDeps) {
		this.deps = deps;
		this.orphanedCardsService = new OrphanedCardsService();
	}

	/**
	 * Handle file deletion event
	 * Called BEFORE FrontmatterIndexService updates its index
	 *
	 * @param file - The deleted file
	 */
	async handleFileDeletion(file: TFile): Promise<void> {
		// Only handle markdown files
		if (file.extension !== "md") return;

		// Get the flashcard_uid from the index (still available at this point)
		const uid = this.deps.frontmatterIndex.getValues(
			"flashcard_uid",
			file.path,
		)[0];
		if (!uid) return;

		// Get cards associated with this source note
		const cards = this.deps.store.getCardsBySourceUid(uid);
		if (cards.length === 0) return;

		// Notify about orphaned cards
		await this.deps.onOrphanedCards({
			cards,
			deletedNoteName: file.basename,
			deletedNotePath: file.path,
			sourceUid: uid,
		});
	}

	/**
	 * Get all orphaned cards (cards with source_uid pointing to non-existent files)
	 * This checks both:
	 * 1. Cards with no source_uid
	 * 2. Cards with source_uid that doesn't match any file
	 *
	 * Delegates to OrphanedCardsService for canonical implementation.
	 */
	getOrphanedCards(): OrphanedCardInfo[] {
		return this.orphanedCardsService.getOrphanedCardsExtended(
			this.deps.store,
			this.deps.frontmatterIndex,
		);
	}

	/**
	 * Group orphaned cards by their source_uid
	 * Cards with same source_uid came from the same deleted note
	 *
	 * Delegates to OrphanedCardsService for canonical implementation.
	 */
	groupOrphansBySourceUid(
		orphans: OrphanedCardInfo[],
	): Map<string, OrphanedCardInfo[]> {
		const groups = this.orphanedCardsService.groupOrphanedCards(orphans);
		// Convert OrphanedCardGroup[] to Map for backward compatibility
		const result = new Map<string, OrphanedCardInfo[]>();
		for (const group of groups) {
			result.set(group.groupKey, group.cards);
		}
		return result;
	}

	/**
	 * Soft delete all orphaned cards
	 */
	deleteOrphanedCards(cardIds: string[]): void {
		this.deps.store.cards.bulkSoftDelete(cardIds);
	}

	/**
	 * Move orphaned cards to a new source note
	 */
	async moveOrphanedCards(
		cardIds: string[],
		newSourceUid: string,
	): Promise<void> {
		for (const cardId of cardIds) {
			this.deps.store.cards.updateCardSourceUid(cardId, newSourceUid);
		}
	}
}

// Re-export types from OrphanedCardsService for backward compatibility
export type { OrphanedCardInfo, OrphanReason } from "../../../library/services/orphaned-cards.service";
