import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import { notify } from "@shared/services/notification.service";
import { notifyCardChange } from "@shared/services/signals";
import type { TFile } from "obsidian";

export interface DeletionHandlerDeps {
	frontmatterIndex: FrontmatterIndexService;
	store: SqliteStoreService;
	sessionPersistence: SessionPersistenceService;
}

/**
 * Auto-deletes all flashcards when their source note is deleted.
 * Cards are permanently bound to notes — no orphans possible.
 */
export class DeletionHandlerService {
	constructor(private deps: DeletionHandlerDeps) {}

	// Called BEFORE FrontmatterIndexService updates its index,
	// so the UID is still available for lookup
	async handleFileDeletion(file: TFile): Promise<void> {
		if (file.extension !== "md") return;

		const uid = this.deps.frontmatterIndex.getValues(
			"flashcard_uid",
			file.path,
		)[0];
		if (!uid) return;

		const cards = this.deps.store.getCardsBySourceUid(uid);
		if (cards.length === 0) return;

		const cardIds = cards.map((c) => c.id);
		this.deps.store.cards.bulkSoftDelete(cardIds);
		this.deps.sessionPersistence.removeReviewedCards(cardIds);
		notifyCardChange({ type: "bulk", cardIds, action: "removed" });
		notify().cardsDeleted(cardIds.length);
	}
}
