import { __awaiter } from "tslib";
import { getSourceNoteNameFromFile } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";
import { pushDeleteUndo } from "@true-recall/obsidian/services/undo.service";
import { useCallback } from "preact/hooks";
import { usePanelScroll } from "./PanelScrollContext";
import { usePanelStore } from "./usePanelStore";
export function useSelectionActions() {
    const { preserveScroll } = usePanelScroll();
    const plugin = usePlugin();
    const app = useApp();
    const { flashcardInfo, currentFile, selectedCardIds, panel } = usePanelStore();
    const handleToggleSelect = useCallback((cardId) => {
        preserveScroll(() => {
            panel.toggleCardSelection(cardId);
        });
    }, [panel, preserveScroll]);
    const handleEnterSelectionMode = useCallback((cardId) => {
        panel.enterSelectionMode(cardId);
    }, [panel]);
    const handleExitSelectionMode = useCallback(() => {
        panel.exitSelectionMode();
    }, [panel]);
    const handleSelectAll = useCallback(() => {
        if (!flashcardInfo)
            return;
        const cardIds = flashcardInfo.flashcards.map((c) => c.id);
        panel.selectAll(cardIds);
    }, [panel, flashcardInfo]);
    const handleMoveSelected = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!flashcardInfo || selectedCardIds.size === 0)
            return;
        const { MoveCardModal } = yield import("@true-recall/obsidian/modals/shared/MoveCardModal");
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        const selectedCards = flashcardInfo.flashcards.filter((card) => selectedCardIds.has(card.id));
        if (selectedCards.length === 0) {
            notify().error("No cards with valid UUIDs selected. Please regenerate flashcards.");
            return;
        }
        const firstCard = selectedCards[0];
        if (!firstCard)
            return;
        const sourceNoteName = yield getSourceNoteNameFromFile(app, currentFile, flashcardInfo);
        const modal = new MoveCardModal(app, {
            cardCount: selectedCards.length,
            sourceNoteName,
            cardQuestion: firstCard.question,
            cardAnswer: firstCard.answer,
        });
        const result = yield modal.openAndWait();
        if (result.cancelled || !result.targetNotePath)
            return;
        const targetPath = result.targetNotePath;
        const results = yield Promise.allSettled(selectedCards.map((card) => plugin.flashcardManager.moveCard(card.id, targetPath)));
        const successCount = results.filter((r) => r.status === "fulfilled").length;
        results.forEach((r, i) => {
            var _a;
            if (r.status === "rejected") {
                console.error(`Failed to move card ${(_a = selectedCards[i]) === null || _a === void 0 ? void 0 : _a.id}:`, r.reason);
            }
        });
        panel.exitSelectionMode();
        notify().success(`Moved ${successCount} of ${selectedCards.length} cards`);
    }), [flashcardInfo, selectedCardIds, currentFile, app, plugin, panel]);
    const handleDeleteSelected = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!flashcardInfo || !currentFile || selectedCardIds.size === 0)
            return;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
        const selectedCards = flashcardInfo.flashcards.filter((card) => selectedCardIds.has(card.id));
        if (selectedCards.length === 0)
            return;
        const confirmed = yield confirm(app, {
            message: `Delete ${selectedCards.length} selected card(s)?`,
        });
        if (!confirmed)
            return;
        const cardIds = selectedCards.map((card) => card.id);
        const result = plugin.flashcardManager.removeFlashcardsByIdsWithDetails(cardIds);
        if (result.ok) {
            pushDeleteUndo(plugin, result);
        }
        panel.exitSelectionMode();
        notify().cardsDeletedWithUndo(result.affectedCount, () => {
            var _a;
            void ((_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.undo());
        });
    }), [flashcardInfo, currentFile, selectedCardIds, plugin, panel]);
    const handleChangeNoteType = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!flashcardInfo || selectedCardIds.size === 0)
            return;
        const { ChangeNoteTypeModal } = yield import("@true-recall/obsidian/modals/library/ChangeNoteTypeModal");
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        const { notifyCardChange } = yield import("@true-recall/obsidian/services/signals");
        const cardIds = Array.from(selectedCardIds);
        const noteInfos = plugin.cardStore.cards.getNoteInfoForCardIds(cardIds);
        if (noteInfos.length === 0)
            return;
        const uniqueTypeIds = new Set(noteInfos.map((n) => n.noteTypeId));
        if (uniqueTypeIds.size > 1) {
            notify().error("Selected cards have different note types. Select cards of one type.");
            return;
        }
        const firstNoteInfo = noteInfos[0];
        if (!firstNoteInfo)
            return;
        const currentTypeId = firstNoteInfo.noteTypeId;
        const currentNoteType = plugin.cardStore.noteTypes.getById(currentTypeId);
        if (!currentNoteType)
            return;
        const allNoteTypes = plugin.cardStore.noteTypes.getAll();
        const modal = new ChangeNoteTypeModal(app, {
            currentNoteType,
            availableNoteTypes: allNoteTypes,
            noteCount: noteInfos.length,
        });
        const result = yield modal.openAndWait();
        if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
            return;
        let totalCreated = 0;
        let totalDeleted = 0;
        for (const info of noteInfos) {
            const r = plugin.flashcardManager.changeNoteType(info.noteId, result.targetNoteTypeId, result.fieldMapping);
            totalCreated += r.createdCardIds.length;
            totalDeleted += r.deletedCardIds.length;
        }
        const parts = [`${noteInfos.length} note(s) changed`];
        if (totalCreated > 0)
            parts.push(`${totalCreated} cards created`);
        if (totalDeleted > 0)
            parts.push(`${totalDeleted} cards removed`);
        notifyCardChange({
            type: "bulk",
            cardIds,
            action: "update",
        });
        notify().success(parts.join(", "));
        panel.exitSelectionMode();
    }), [flashcardInfo, selectedCardIds, app, plugin, panel]);
    const handleSuspendSelected = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!flashcardInfo || selectedCardIds.size === 0)
            return;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        const { notifyCardChange } = yield import("@true-recall/obsidian/services/signals");
        const cardIds = Array.from(selectedCardIds);
        const count = plugin.cardStore.cards.bulkSuspend(cardIds);
        notifyCardChange({ type: "bulk", cardIds, action: "suspend" });
        panel.exitSelectionMode();
        notify().success(`Suspended ${count} card(s)`);
    }), [flashcardInfo, selectedCardIds, plugin, panel]);
    const handleUnsuspendSelected = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!flashcardInfo || selectedCardIds.size === 0)
            return;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        const { notifyCardChange } = yield import("@true-recall/obsidian/services/signals");
        const cardIds = Array.from(selectedCardIds);
        const count = plugin.cardStore.cards.bulkUnsuspend(cardIds);
        notifyCardChange({ type: "bulk", cardIds, action: "unsuspend" });
        panel.exitSelectionMode();
        notify().success(`Unsuspended ${count} card(s)`);
    }), [flashcardInfo, selectedCardIds, plugin, panel]);
    const handleForgetSelected = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!flashcardInfo || selectedCardIds.size === 0)
            return;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        const { notifyCardChange } = yield import("@true-recall/obsidian/services/signals");
        const cardIds = Array.from(selectedCardIds);
        const count = plugin.cardStore.cards.bulkForget(cardIds);
        if (count === 0) {
            notify().warning("Forget is only available for non-New cards");
            return;
        }
        (_a = plugin.sessionPersistence) === null || _a === void 0 ? void 0 : _a.removeReviewedCards(cardIds);
        notifyCardChange({ type: "bulk", cardIds, action: "reset" });
        panel.exitSelectionMode();
        notify().cardsForgotten(count);
    }), [flashcardInfo, selectedCardIds, plugin, panel]);
    return {
        handleToggleSelect,
        handleEnterSelectionMode,
        handleExitSelectionMode,
        handleSelectAll,
        handleMoveSelected,
        handleChangeNoteType,
        handleSuspendSelected,
        handleUnsuspendSelected,
        handleForgetSelected,
        handleDeleteSelected,
    };
}
