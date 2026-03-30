import { __awaiter } from "tslib";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { notifyCardChange } from "@true-recall/obsidian/services/signals";
export class UndoService {
    constructor(plugin) {
        this.stack = [];
        this.maxStackSize = 50;
        /** ReviewApi for inserting cards back into queue (set when ReviewView is open) */
        this.reviewStateManager = null;
        /** Callbacks for review session updates */
        this.reviewCallbacks = null;
        this.plugin = plugin;
    }
    setReviewStateManager(manager, callbacks) {
        this.reviewStateManager = manager;
        this.reviewCallbacks = callbacks;
    }
    push(entry) {
        this.stack.push(entry);
        // Trim stack if exceeds max size
        if (this.stack.length > this.maxStackSize) {
            this.stack.shift();
        }
    }
    canUndo() {
        return this.stack.length > 0;
    }
    peekDescription() {
        var _a;
        const entry = this.stack[this.stack.length - 1];
        return (_a = entry === null || entry === void 0 ? void 0 : entry.description) !== null && _a !== void 0 ? _a : null;
    }
    getStackSize() {
        return this.stack.length;
    }
    undo() {
        return __awaiter(this, void 0, void 0, function* () {
            const entry = this.stack.pop();
            if (!entry) {
                notify().nothingToUndo();
                return false;
            }
            try {
                const success = yield this.executeUndo(entry);
                if (success) {
                    notify().undoComplete(entry.description);
                }
                else {
                    notify().undoFailed(entry.description);
                }
                return success;
            }
            catch (error) {
                console.error("[UndoService] Error executing undo:", error);
                notify().undoFailed(entry.description);
                return false;
            }
        });
    }
    executeUndo(entry) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const writeCancelled = (_b = (_a = entry.cancelPendingWrite) === null || _a === void 0 ? void 0 : _a.call(entry)) !== null && _b !== void 0 ? _b : false;
            const { flashcardManager } = this.plugin;
            const payload = entry.payload;
            switch (payload.type) {
                case "create":
                    return yield flashcardManager.removeFlashcardById(payload.cardId);
                case "update":
                    flashcardManager.updateCardContent(payload.cardId, payload.previousQuestion, payload.previousAnswer);
                    if (this.reviewStateManager) {
                        const currentCard = this.reviewStateManager.getCurrentCard();
                        if ((currentCard === null || currentCard === void 0 ? void 0 : currentCard.id) === payload.cardId) {
                            this.reviewStateManager.updateCurrentCardContent(payload.previousQuestion, payload.previousAnswer);
                        }
                    }
                    return true;
                case "delete":
                    return this.restoreDeletedCard(payload.cardData);
                case "batch-delete":
                    return this.restoreBatchDeletedCards(payload.cardsData);
                case "batch-create":
                    for (const cardId of payload.cardIds) {
                        yield flashcardManager.removeFlashcardById(cardId);
                    }
                    return true;
                case "answer":
                    return yield this.undoAnswer(payload, writeCancelled);
                case "bury":
                    return this.undoBury(payload, writeCancelled);
                case "suspend":
                    return this.undoSuspend(payload, writeCancelled);
                case "forget":
                    return this.undoForget(payload, writeCancelled);
                case "update-note-fields":
                    return this.undoUpdateNoteFields(payload);
                case "fsrs-helper-operation":
                    return this.undoFSRSHelperOperation(payload);
                default:
                    console.error(`[UndoService] Unknown undo payload type`);
                    return false;
            }
        });
    }
    restoreDeletedCard(cardData) {
        try {
            const { cardStore } = this.plugin;
            // Restore the card using the store's set method
            cardStore.set(cardData.id, cardData);
            notifyCardChange({ type: "added", cardId: cardData.id });
            return true;
        }
        catch (error) {
            console.error("[UndoService] Error restoring card:", error);
            return false;
        }
    }
    restoreBatchDeletedCards(cardsData) {
        try {
            const { cardStore } = this.plugin;
            for (const cardData of cardsData) {
                cardStore.set(cardData.id, cardData);
            }
            notifyCardChange({
                type: "bulk",
                cardIds: cardsData.map((c) => c.id),
                action: "added",
            });
            return true;
        }
        catch (error) {
            console.error("[UndoService] Error restoring batch-deleted cards:", error);
            return false;
        }
    }
    undoAnswer(payload, writeCancelled) {
        return __awaiter(this, void 0, void 0, function* () {
            // If the deferred write was cancelled, DB still has original FSRS — no write needed
            if (!writeCancelled) {
                this.plugin.flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);
            }
            if (this.reviewCallbacks) {
                this.reviewCallbacks.onUndoAnswer(payload, writeCancelled);
                this.reviewCallbacks.onUpdateSchedulingPreview();
            }
            return true;
        });
    }
    undoBury(payload, writeCancelled) {
        const { flashcardManager } = this.plugin;
        if (!writeCancelled) {
            flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);
        }
        if (this.reviewStateManager) {
            this.reviewStateManager.insertCardAtPosition(Object.assign(Object.assign({}, payload.card), { fsrs: payload.originalFsrs }), payload.previousIndex);
        }
        if (payload.additionalCards) {
            for (const additionalCard of payload.additionalCards) {
                if (!writeCancelled) {
                    flashcardManager.updateCardFSRS(additionalCard.card.id, additionalCard.originalFsrs);
                }
            }
        }
        if (this.reviewCallbacks) {
            this.reviewCallbacks.onUpdateSchedulingPreview();
        }
        return true;
    }
    undoSuspend(payload, writeCancelled) {
        if (!writeCancelled) {
            this.plugin.flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);
        }
        if (this.reviewStateManager) {
            this.reviewStateManager.insertCardAtPosition(Object.assign(Object.assign({}, payload.card), { fsrs: payload.originalFsrs }), payload.previousIndex);
        }
        if (this.reviewCallbacks) {
            this.reviewCallbacks.onUpdateSchedulingPreview();
        }
        return true;
    }
    undoForget(payload, writeCancelled) {
        // Restore FSRS state (review_log soft-delete is not reversed)
        if (!writeCancelled) {
            this.plugin.flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);
        }
        if (this.reviewStateManager) {
            this.reviewStateManager.insertCardAtPosition(Object.assign(Object.assign({}, payload.card), { fsrs: payload.originalFsrs }), payload.previousIndex);
        }
        if (this.reviewCallbacks) {
            this.reviewCallbacks.onUpdateSchedulingPreview();
        }
        // Re-add to daily_reviewed_cards (forget removed it)
        const sessionPersistence = this.plugin.sessionPersistence;
        if (sessionPersistence) {
            const today = sessionPersistence.getTodayKey();
            this.plugin.cardStore.stats.recordReviewedCard(today, payload.card.id);
        }
        return true;
    }
    undoUpdateNoteFields(payload) {
        try {
            this.plugin.flashcardManager.updateNoteFields(payload.noteId, payload.previousFields);
            return true;
        }
        catch (error) {
            console.error("[UndoService] Failed to undo note field update:", error);
            return false;
        }
    }
    undoFSRSHelperOperation(payload) {
        try {
            const { cardStore } = this.plugin;
            for (const change of payload.changes) {
                cardStore.cards.updateCardDue(change.cardId, change.originalDue);
            }
            notifyCardChange({
                type: "bulk",
                cardIds: payload.changes.map((c) => c.cardId),
                action: "reschedule",
            });
            return true;
        }
        catch (error) {
            console.error("[UndoService] Failed to undo FSRS Helper operation:", error);
            return false;
        }
    }
    clear() {
        this.stack = [];
    }
    clearSessionEntries() {
        const sessionTypes = new Set(["answer", "bury", "suspend", "forget"]);
        this.stack = this.stack.filter((entry) => !sessionTypes.has(entry.payload.type));
    }
}
/**
 * Push an undo entry for a delete operation.
 * Uses "delete" for single card, "batch-delete" for multiple.
 */
export function pushDeleteUndo(plugin, result) {
    var _a, _b;
    if (result.deletedCardsData.length === 0)
        return;
    const description = result.affectedCount === 1
        ? "Delete card"
        : `Delete ${result.affectedCount} cards`;
    const firstCardData = result.deletedCardsData[0];
    if (result.deletedCardsData.length === 1 && firstCardData) {
        (_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.push({
            id: crypto.randomUUID(),
            actionType: "delete",
            description,
            timestamp: Date.now(),
            payload: { type: "delete", cardData: firstCardData },
        });
    }
    else {
        (_b = plugin.undoService) === null || _b === void 0 ? void 0 : _b.push({
            id: crypto.randomUUID(),
            actionType: "batch-delete",
            description,
            timestamp: Date.now(),
            payload: { type: "batch-delete", cardsData: result.deletedCardsData },
        });
    }
}
