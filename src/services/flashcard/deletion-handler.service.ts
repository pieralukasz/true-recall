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
import type { FrontmatterIndexService } from "../core/frontmatter-index.service";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type { FSRSCardData } from "../../types";

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

	constructor(deps: DeletionHandlerDeps) {
		this.deps = deps;
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
		const uid = this.deps.frontmatterIndex.getValues("flashcard_uid", file.path)[0];
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
	 */
	getOrphanedCards(): OrphanedCardInfo[] {
		const allCards = this.deps.store.cards.getAll();
		const orphans: OrphanedCardInfo[] = [];

		for (const card of allCards) {
			if (!card.sourceUid) {
				orphans.push({
					...card,
					orphanReason: "no_source_uid",
				});
			} else {
				const sourceFile = this.deps.frontmatterIndex.getFileByValue(
					"flashcard_uid",
					card.sourceUid
				);
				if (!sourceFile) {
					orphans.push({
						...card,
						orphanReason: "missing_source_file",
						missingSourceUid: card.sourceUid,
					});
				}
			}
		}

		return orphans;
	}

	/**
	 * Group orphaned cards by their source_uid
	 * Cards with same source_uid came from the same deleted note
	 */
	groupOrphansBySourceUid(orphans: OrphanedCardInfo[]): Map<string, OrphanedCardInfo[]> {
		const groups = new Map<string, OrphanedCardInfo[]>();

		for (const orphan of orphans) {
			const key = orphan.missingSourceUid ?? "no_source_uid";
			const existing = groups.get(key) ?? [];
			existing.push(orphan);
			groups.set(key, existing);
		}

		return groups;
	}

	/**
	 * Soft delete all orphaned cards
	 */
	deleteOrphanedCards(cardIds: string[]): void {
		this.deps.store.browser.bulkSoftDelete(cardIds);
	}

	/**
	 * Move orphaned cards to a new source note
	 */
	async moveOrphanedCards(cardIds: string[], newSourceUid: string): Promise<void> {
		for (const cardId of cardIds) {
			this.deps.store.cards.updateCardSourceUid(cardId, newSourceUid);
		}
	}
}

export type OrphanReason = "no_source_uid" | "missing_source_file";

export interface OrphanedCardInfo extends FSRSCardData {
	orphanReason: OrphanReason;
	missingSourceUid?: string;
}
