import { notifyCardChange } from "@true-recall/core/events";
/**
 * Auto-deletes all flashcards when their source note is deleted.
 * Cards are permanently bound to notes -- no orphans possible.
 */
export class DeletionHandlerService {
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * Called BEFORE FrontmatterIndexService updates its index,
     * so the UID is still available for lookup.
     * @param filePath - path of the deleted file (must be a .md file)
     */
    handleFileDeletion(filePath) {
        var _a;
        if (!filePath.endsWith(".md"))
            return;
        const uid = this.deps.frontmatterIndex.getValues("flashcard_uid", filePath)[0];
        if (!uid)
            return;
        const cards = this.deps.store.getCardsBySourceUid(uid);
        if (cards.length === 0)
            return;
        const cardIds = cards.map((c) => c.id);
        this.deps.store.cards.bulkSoftDelete(cardIds);
        this.deps.sessionPersistence.removeReviewedCards(cardIds);
        notifyCardChange({ type: "bulk", cardIds, action: "removed" });
        (_a = this.deps.notification) === null || _a === void 0 ? void 0 : _a.cardsDeleted(cardIds.length);
    }
}
