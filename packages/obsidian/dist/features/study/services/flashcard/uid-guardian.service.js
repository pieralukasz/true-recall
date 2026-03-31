import { __awaiter } from "tslib";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { notifyCardChange } from "@true-recall/obsidian/services/signals";
import { TFile } from "obsidian";
import { UidRemovedModal } from "@true-recall/obsidian/modals/study/UidRemovedModal";
/**
 * Watches for accidental removal or modification of flashcard_uid in frontmatter.
 * Value changed → auto-restores original UID (no legitimate reason to edit it).
 * Value removed → shows recovery modal (restore / delete / move cards).
 */
export class UidGuardianService {
    constructor(deps) {
        this.deps = deps;
        this.restoringPaths = new Set();
    }
    register() {
        this.deps.frontmatterIndex.onFieldChange("flashcard_uid", (event) => void this.handleFieldChange(event));
    }
    handleFieldChange(event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (event.oldValues.length === 0)
                return;
            const removedUid = event.oldValues[0];
            if (!removedUid)
                return;
            // Skip bounce-back from our own restore
            if (this.restoringPaths.has(event.path)) {
                this.restoringPaths.delete(event.path);
                return;
            }
            const cards = this.deps.store.getCardsBySourceUid(removedUid);
            if (cards.length === 0)
                return;
            const file = this.deps.app.vault.getAbstractFileByPath(event.path);
            if (!(file instanceof TFile))
                return;
            // VALUE CHANGED — auto-restore to prevent silent orphaning
            if (event.newValues.length > 0 && event.newValues[0] !== removedUid) {
                this.restoringPaths.add(event.path);
                yield this.deps.frontmatterService.setSourceNoteUid(file.path, removedUid);
                notify().info(`flashcard_uid restored — ${cards.length} card${cards.length === 1 ? "" : "s"} protected`);
                return;
            }
            // VALUE REMOVED — show recovery modal
            const modal = new UidRemovedModal(this.deps.app, {
                fileName: file.basename,
                removedUid,
                cardCount: cards.length,
            });
            const result = yield modal.openAndWait();
            if (result.cancelled)
                return;
            switch (result.action) {
                case "restore":
                    this.restoringPaths.add(event.path);
                    yield this.deps.frontmatterService.setSourceNoteUid(file.path, removedUid);
                    break;
                case "delete": {
                    const cardIds = cards.map((c) => c.id);
                    this.deps.store.cards.bulkSoftDelete(cardIds);
                    this.deps.sessionPersistence.removeReviewedCards(cardIds);
                    notifyCardChange({ type: "bulk", cardIds, action: "removed" });
                    notify().cardsDeleted(cardIds.length);
                    break;
                }
                case "move":
                    if (result.targetNotePath) {
                        yield this.moveCardsToNote(cards.map((c) => c.id), result.targetNotePath);
                    }
                    break;
            }
        });
    }
    moveCardsToNote(cardIds, targetNotePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const targetFile = this.deps.app.vault.getAbstractFileByPath(targetNotePath);
            if (!(targetFile instanceof TFile)) {
                notify().error("Target note not found");
                return;
            }
            let targetUid = yield this.deps.frontmatterService.getSourceNoteUid(targetFile.path);
            if (!targetUid) {
                targetUid = this.deps.frontmatterService.generateUid();
                yield this.deps.frontmatterService.setSourceNoteUid(targetFile.path, targetUid);
            }
            for (const cardId of cardIds) {
                this.deps.store.cards.updateCardSourceUid(cardId, targetUid);
            }
            notifyCardChange({ type: "bulk", cardIds, action: "update" });
            notify().cardsMoved(cardIds.length, targetFile.basename);
        });
    }
}
