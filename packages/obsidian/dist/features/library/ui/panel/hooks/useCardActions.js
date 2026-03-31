import { __awaiter } from "tslib";
import { BUILTIN_BASIC_ID, BUILTIN_BASIC_REVERSED_ID, } from "@true-recall/core/types";
import { openPanelCardEditor } from "@true-recall/obsidian/features/library/ui/panel/helpers/panel-edit-routing";
import { cardToBlockText, getSourceNoteNameFromFile, } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { notifyCardChange } from "@true-recall/obsidian/services/signals";
import { pushDeleteUndo } from "@true-recall/obsidian/services/undo.service";
import { useCallback } from "preact/hooks";
import { usePanelScroll } from "./PanelScrollContext";
import { usePanelStore } from "./usePanelStore";
export function useCardActions() {
    const { preserveScroll, captureScroll } = usePanelScroll();
    const plugin = usePlugin();
    const app = useApp();
    const { currentFile, flashcardInfo, cardsWithFsrs, panel } = usePanelStore();
    const findFsrsCard = (cardId) => {
        return cardsWithFsrs.find((c) => c.id === cardId);
    };
    const openEditModal = useCallback((card, restoreScroll) => __awaiter(this, void 0, void 0, function* () {
        const fsrsCard = findFsrsCard(card.id);
        if (!(fsrsCard === null || fsrsCard === void 0 ? void 0 : fsrsCard.noteId)) {
            notify().error("Cannot edit card: missing note link. Please restart Obsidian to complete database migration.");
            return;
        }
        const note = plugin.cardStore.notes.getById(fsrsCard.noteId);
        if (!note) {
            notify().error("Note not found");
            return;
        }
        const noteType = plugin.cardStore.noteTypes.getById(note.noteTypeId);
        if (!noteType) {
            notify().error("Note type not found");
            return;
        }
        yield openPanelCardEditor({
            note,
            noteType,
            openImageOcclusionEditor: (mode) => plugin.openImageOcclusionEditor(mode),
            openQuickEditor: () => __awaiter(this, void 0, void 0, function* () {
                const modal = new QuickNoteEditorModal(app, plugin, {
                    mode: "edit",
                    cardId: card.id,
                    noteId: note.id,
                    note,
                    noteType,
                });
                yield modal.openAndWait();
            }),
        });
        restoreScroll();
    }), [app, plugin, cardsWithFsrs]);
    const handleAddFlashcard = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const sourceUid = flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.sourceUid;
        const modal = new QuickNoteEditorModal(app, plugin, {
            mode: "add",
            sourceUid,
        });
        yield modal.openAndWait();
    }), [app, plugin, flashcardInfo]);
    const handleEditButton = useCallback((card) => __awaiter(this, void 0, void 0, function* () {
        const restoreScroll = captureScroll();
        yield openEditModal(card, restoreScroll);
    }), [openEditModal, captureScroll]);
    const handleDeleteCard = useCallback((card) => __awaiter(this, void 0, void 0, function* () {
        if (!currentFile)
            return;
        const restoreScroll = captureScroll();
        const result = yield plugin.flashcardManager.removeFlashcardByIdWithDetails(card.id);
        if (result.ok) {
            pushDeleteUndo(plugin, result);
            notify().cardsDeletedWithUndo(result.affectedCount, () => {
                var _a;
                void ((_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.undo());
            });
            restoreScroll();
        }
        else {
            notify().error("Failed to remove flashcard from file");
        }
    }), [currentFile, plugin, captureScroll]);
    const handleCopyCard = useCallback((card) => __awaiter(this, void 0, void 0, function* () {
        const text = cardToBlockText(card, plugin);
        yield navigator.clipboard.writeText(text);
        notify().success("Copied to clipboard");
    }), [plugin]);
    const handleMoveCard = useCallback((card) => __awaiter(this, void 0, void 0, function* () {
        if (!flashcardInfo)
            return;
        if (!card.id) {
            notify().error("Cannot move card without UUID. Please regenerate flashcards.");
            return;
        }
        const sourceNoteName = yield getSourceNoteNameFromFile(app, currentFile, flashcardInfo);
        const { MoveCardModal } = yield import("@true-recall/obsidian/modals/shared/MoveCardModal");
        const modal = new MoveCardModal(app, {
            cardCount: 1,
            sourceNoteName,
            cardQuestion: card.question,
            cardAnswer: card.answer,
        });
        const result = yield modal.openAndWait();
        if (result.cancelled || !result.targetNotePath)
            return;
        try {
            yield plugin.flashcardManager.moveCard(card.id, result.targetNotePath);
            notify().cardsMoved(1, result.targetNotePath);
        }
        catch (error) {
            notify().operationFailed("move card", error);
        }
    }), [currentFile, flashcardInfo, app, plugin]);
    const handleChangeType = useCallback((card) => __awaiter(this, void 0, void 0, function* () {
        const fsrsCard = findFsrsCard(card.id);
        if (!(fsrsCard === null || fsrsCard === void 0 ? void 0 : fsrsCard.noteId)) {
            notify().error("Cannot change type: missing note link.");
            return;
        }
        const note = plugin.cardStore.notes.getById(fsrsCard.noteId);
        if (!note) {
            notify().error("Note not found");
            return;
        }
        const currentNoteType = plugin.cardStore.noteTypes.getById(note.noteTypeId);
        if (!currentNoteType) {
            notify().error("Note type not found");
            return;
        }
        const { ChangeNoteTypeModal } = yield import("@true-recall/obsidian/modals/library/ChangeNoteTypeModal");
        const { notifyCardChange } = yield import("@true-recall/obsidian/services/signals");
        const allNoteTypes = plugin.cardStore.noteTypes.getAll();
        const modal = new ChangeNoteTypeModal(app, {
            currentNoteType,
            availableNoteTypes: allNoteTypes,
            noteCount: 1,
        });
        const result = yield modal.openAndWait();
        if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
            return;
        const r = plugin.flashcardManager.changeNoteType(fsrsCard.noteId, result.targetNoteTypeId, result.fieldMapping);
        const parts = ["Note type changed"];
        if (r.createdCardIds.length > 0)
            parts.push(`${r.createdCardIds.length} cards created`);
        if (r.deletedCardIds.length > 0)
            parts.push(`${r.deletedCardIds.length} cards removed`);
        notifyCardChange({
            type: "bulk",
            cardIds: [card.id, ...r.createdCardIds, ...r.deletedCardIds],
            action: "update",
        });
        notify().success(parts.join(", "));
    }), [app, plugin, cardsWithFsrs]);
    const handleToggleReversed = useCallback((card) => __awaiter(this, void 0, void 0, function* () {
        const fsrsCard = findFsrsCard(card.id);
        if (!(fsrsCard === null || fsrsCard === void 0 ? void 0 : fsrsCard.noteId)) {
            notify().error("Cannot toggle reversed: missing note link.");
            return;
        }
        const note = plugin.cardStore.notes.getById(fsrsCard.noteId);
        if (!note) {
            notify().error("Note not found");
            return;
        }
        const { noteTypeId } = note;
        let targetNoteTypeId;
        if (noteTypeId === BUILTIN_BASIC_ID) {
            targetNoteTypeId = BUILTIN_BASIC_REVERSED_ID;
        }
        else if (noteTypeId === BUILTIN_BASIC_REVERSED_ID) {
            targetNoteTypeId = BUILTIN_BASIC_ID;
        }
        else {
            notify().warning("Reversed is only available for basic cards");
            return;
        }
        const { notifyCardChange } = yield import("@true-recall/obsidian/services/signals");
        const fieldMapping = { Front: "Front", Back: "Back" };
        const r = plugin.flashcardManager.changeNoteType(fsrsCard.noteId, targetNoteTypeId, fieldMapping);
        notifyCardChange({
            type: "bulk",
            cardIds: [card.id, ...r.createdCardIds, ...r.deletedCardIds],
            action: "update",
        });
        if (targetNoteTypeId === BUILTIN_BASIC_REVERSED_ID) {
            notify().success("Reversed card created");
        }
        else {
            notify().success("Reversed card removed");
        }
    }), [plugin, cardsWithFsrs]);
    const handleForgetCard = useCallback((card) => {
        var _a;
        const forgottenCount = plugin.cardStore.cards.bulkForget([card.id]);
        if (forgottenCount === 0) {
            notify().warning("Forget is only available for non-New cards");
            return;
        }
        (_a = plugin.sessionPersistence) === null || _a === void 0 ? void 0 : _a.removeReviewedCards([card.id]);
        notifyCardChange({ type: "bulk", cardIds: [card.id], action: "reset" });
        notify().cardForgotten();
    }, [plugin]);
    const handleSuspendCard = useCallback((card) => {
        plugin.cardStore.cards.bulkSuspend([card.id]);
        notifyCardChange({ type: "bulk", cardIds: [card.id], action: "suspend" });
        notify().success("Card suspended");
    }, [plugin]);
    const handleUnsuspendCard = useCallback((card) => {
        plugin.cardStore.cards.bulkUnsuspend([card.id]);
        notifyCardChange({
            type: "bulk",
            cardIds: [card.id],
            action: "unsuspend",
        });
        notify().success("Card unsuspended");
    }, [plugin]);
    const handleToggleExpand = useCallback((cardId) => {
        preserveScroll(() => {
            panel.toggleCardExpanded(cardId);
        });
    }, [panel, preserveScroll]);
    return {
        handleAddFlashcard,
        handleEditButton,
        handleDeleteCard,
        handleCopyCard,
        handleMoveCard,
        handleChangeType,
        handleToggleReversed,
        handleForgetCard,
        handleSuspendCard,
        handleUnsuspendCard,
        handleToggleExpand,
    };
}
