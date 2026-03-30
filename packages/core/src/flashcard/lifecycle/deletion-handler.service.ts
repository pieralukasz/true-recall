import { notifyCardChange } from "@true-recall/core/events";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";

/**
 * Platform-agnostic session persistence interface.
 * The concrete implementation is injected from the platform layer.
 */
export interface ISessionPersistence {
	removeReviewedCards(cardIds: string[]): void;
}

export interface DeletionHandlerDeps {
	frontmatterIndex: FrontmatterIndexService;
	store: SqliteStoreService;
	sessionPersistence: ISessionPersistence;
	notification?: { cardsDeleted(count: number): void };
}

/**
 * Auto-deletes all flashcards when their source note is deleted.
 * Cards are permanently bound to notes -- no orphans possible.
 */
export class DeletionHandlerService {
	constructor(private deps: DeletionHandlerDeps) {}

	/**
	 * Called BEFORE FrontmatterIndexService updates its index,
	 * so the UID is still available for lookup.
	 * @param filePath - path of the deleted file (must be a .md file)
	 */
	handleFileDeletion(filePath: string): void {
		if (!filePath.endsWith(".md")) return;

		const uid = this.deps.frontmatterIndex.getValues(
			"flashcard_uid",
			filePath,
		)[0];
		if (!uid) return;

		const cards = this.deps.store.getCardsBySourceUid(uid);
		if (cards.length === 0) return;

		const cardIds = cards.map((c) => c.id);
		this.deps.store.cards.bulkSoftDelete(cardIds);
		this.deps.sessionPersistence.removeReviewedCards(cardIds);
		notifyCardChange({ type: "bulk", cardIds, action: "removed" });
		this.deps.notification?.cardsDeleted(cardIds.length);
	}
}
