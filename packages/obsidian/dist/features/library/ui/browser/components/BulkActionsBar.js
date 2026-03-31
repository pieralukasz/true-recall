import { __awaiter } from "tslib";
import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
import { ChangeNoteTypeModal } from "@true-recall/obsidian/modals/library/ChangeNoteTypeModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { notifyCardChange } from "@true-recall/obsidian/services/signals";
import { pushDeleteUndo } from "@true-recall/obsidian/services/undo.service";
import { Clickable } from "@true-recall/obsidian/components";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";
import { useCallback } from "preact/hooks";
export function BulkActionsBar({ selectedCount, selectedIds, onClearSelection, onSelectAll, totalCount, }) {
    const app = useApp();
    const plugin = usePlugin();
    const ids = Array.from(selectedIds);
    const handleSuspend = useCallback(() => {
        const count = plugin.cardStore.cards.bulkSuspend(ids);
        notifyCardChange({ type: "bulk", cardIds: ids, action: "suspend" });
        notify().success(`Suspended ${count} cards`);
        onClearSelection();
    }, [ids, plugin]);
    const handleUnsuspend = useCallback(() => {
        const count = plugin.cardStore.cards.bulkUnsuspend(ids);
        notifyCardChange({ type: "bulk", cardIds: ids, action: "unsuspend" });
        notify().success(`Unsuspended ${count} cards`);
        onClearSelection();
    }, [ids, plugin]);
    const handleForget = useCallback(() => {
        var _a;
        const count = plugin.cardStore.cards.bulkForget(ids);
        if (count === 0) {
            notify().warning("Forget is only available for non-New cards");
            return;
        }
        (_a = plugin.sessionPersistence) === null || _a === void 0 ? void 0 : _a.removeReviewedCards(ids);
        notifyCardChange({ type: "bulk", cardIds: ids, action: "reset" });
        notify().cardsForgotten(count);
        onClearSelection();
    }, [ids, plugin]);
    const handleChangeType = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const noteInfos = plugin.cardStore.cards.getNoteInfoForCardIds(ids);
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
        notify().success(parts.join(", "));
        onClearSelection();
    }), [ids, plugin, app]);
    const handleDelete = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
        if (!(yield confirm(app, { message: `Delete ${ids.length} cards?` })))
            return;
        const result = plugin.flashcardManager.removeFlashcardsByIdsWithDetails(ids);
        if (result.ok) {
            pushDeleteUndo(plugin, result);
        }
        notify().cardsDeletedWithUndo(result.affectedCount, () => {
            var _a;
            void ((_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.undo());
        });
        onClearSelection();
    }), [ids, plugin, app]);
    return (_jsxs("div", { class: "ep:shrink-0 ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-interactive/5 ep:border-b ep:border-obs-interactive/20", children: [_jsxs("span", { class: "ep:text-sm ep:font-medium ep:text-obs-normal", children: [selectedCount, " selected"] }), selectedCount < totalCount && (_jsxs(Clickable, { class: "ep:text-[11px] ep:text-obs-interactive ep:underline", onClick: onSelectAll, children: ["Select all ", totalCount] })), _jsxs("div", { class: "ep:ml-auto ep:flex ep:items-center ep:gap-1.5", children: [_jsx(ActionButton, { label: "Suspend", onClick: handleSuspend }), _jsx(ActionButton, { label: "Unsuspend", onClick: handleUnsuspend }), _jsx(ActionButton, { label: "Forget", onClick: handleForget }), _jsx(ActionButton, { label: "Change type", onClick: () => void handleChangeType() }), _jsx(ActionButton, { label: "Delete", onClick: () => void handleDelete(), danger: true })] }), _jsx(Clickable, { class: "ep:p-1 ep:rounded hover:ep:bg-obs-modifier-hover ep:text-obs-muted", onClick: onClearSelection, children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "aria-hidden": "true", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }));
}
function ActionButton({ label, onClick, danger = false, }) {
    return (_jsx(Clickable, { class: `ep:px-2.5 ep:py-1 ep:rounded ep:text-[11px] ep:font-medium ep:border ep:border-obs-border hover:ep:bg-obs-modifier-hover ${danger
            ? "ep:text-obs-error hover:ep:border-obs-error/30"
            : "ep:text-obs-normal"}`, onClick: onClick, children: label }));
}
