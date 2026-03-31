import { __awaiter } from "tslib";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { pushDeleteUndo } from "@true-recall/obsidian/services/undo.service";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
export function handleDeleteCard(app, card, setCards, allCards, flashcardManager, plugin) {
    return __awaiter(this, void 0, void 0, function* () {
        const confirmed = yield confirm(app, {
            message: "Delete this flashcard?",
        });
        if (!confirmed)
            return allCards;
        const result = yield flashcardManager.removeFlashcardByIdWithDetails(card.id);
        if (result.ok) {
            if (plugin) {
                pushDeleteUndo(plugin, result);
                notify().cardsDeletedWithUndo(result.affectedCount, () => {
                    var _a;
                    void ((_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.undo());
                });
            }
            else {
                notify().cardsDeleted(result.affectedCount);
            }
            const removedIds = new Set(result.affectedIds);
            const updated = allCards.filter((c) => !removedIds.has(c.id));
            setCards(updated);
            return updated;
        }
        notify().operationFailed("delete flashcard");
        return allCards;
    });
}
export function handleUnburyCard(card, setCards, allCards, flashcardManager) {
    const fullCard = allCards.find((c) => c.id === card.id);
    if (!fullCard) {
        notify().error("Could not find card");
        return allCards;
    }
    const updatedFsrs = Object.assign(Object.assign({}, fullCard.fsrs), { buriedUntil: undefined });
    try {
        flashcardManager.updateCardFSRS(fullCard.id, updatedFsrs);
        const updated = allCards.filter((c) => c.id !== card.id);
        setCards(updated);
        notify().cardsStatusChanged(1, "unburied");
        return updated;
    }
    catch (error) {
        console.error("Error unburying card:", error);
        notify().operationFailed("unbury card", error);
        return allCards;
    }
}
export function handleUnburyAll(cards, setCards, flashcardManager) {
    let unburiedCount = 0;
    const failedCards = [];
    for (const card of cards) {
        const updatedFsrs = Object.assign(Object.assign({}, card.fsrs), { buriedUntil: undefined });
        try {
            flashcardManager.updateCardFSRS(card.id, updatedFsrs);
            unburiedCount++;
        }
        catch (error) {
            console.error(`Error unburying card ${card.id}:`, error);
            failedCards.push(card);
        }
    }
    setCards(failedCards);
    if (failedCards.length > 0 && unburiedCount > 0) {
        notify().warning(`Unburied ${unburiedCount} of ${cards.length} cards, ${failedCards.length} failed`);
    }
    else if (failedCards.length > 0) {
        notify().operationFailed("unbury cards");
    }
    else {
        notify().cardsStatusChanged(unburiedCount, "unburied");
    }
}
export function handleDeleteAll(app, cards, setCards, flashcardManager, plugin) {
    return __awaiter(this, void 0, void 0, function* () {
        const confirmed = yield confirm(app, {
            message: `Delete all ${cards.length} suspended cards?`,
        });
        if (!confirmed)
            return;
        const result = flashcardManager.removeFlashcardsByIdsWithDetails(cards.map((card) => card.id));
        if (result.ok && plugin) {
            pushDeleteUndo(plugin, result);
        }
        const removedIds = new Set(result.affectedIds);
        setCards(cards.filter((card) => !removedIds.has(card.id)));
        if (result.ok && plugin) {
            notify().cardsDeletedWithUndo(result.affectedCount, () => {
                var _a;
                void ((_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.undo());
            });
        }
        else {
            notify().cardsDeleted(result.affectedCount);
        }
    });
}
export function openSourceNote(card, app, closeModal) {
    return __awaiter(this, void 0, void 0, function* () {
        const leaf = app.workspace.getLeaf(false);
        if (card.sourceNoteName) {
            const sourceFile = app.vault
                .getMarkdownFiles()
                .find((f) => f.basename === card.sourceNoteName);
            if (sourceFile) {
                yield leaf.openFile(sourceFile);
                closeModal();
                return;
            }
        }
        notify().warning("Could not find source note for this card");
    });
}
