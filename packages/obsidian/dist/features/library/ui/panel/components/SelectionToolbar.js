import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { IconButton } from "@true-recall/obsidian/components";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { useSelectionActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useSelectionActions";
export function SelectionToolbar() {
    var _a;
    const { selectedCardIds, flashcardInfo } = usePanelStore();
    const { handleExitSelectionMode, handleSelectAll, handleMoveSelected, handleChangeNoteType, handleSuspendSelected, handleUnsuspendSelected, handleForgetSelected, handleDeleteSelected, } = useSelectionActions();
    const selectedCount = selectedCardIds.size;
    const totalCount = (_a = flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.flashcards.length) !== null && _a !== void 0 ? _a : 0;
    const allSelected = selectedCount === totalCount && totalCount > 0;
    const hasSelection = selectedCount > 0;
    return (_jsx("div", { class: "ep:flex ep:flex-col ep:gap-2", children: _jsxs("div", { class: "ep:flex ep:items-center ep:justify-between", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx(IconButton, { icon: "x", ariaLabel: "Exit selection mode", onClick: handleExitSelectionMode, size: "small" }), _jsxs("span", { class: "ep:text-ui-small ep:font-semibold ep:text-obs-normal", children: [selectedCount, " selected"] })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-1", children: [!allSelected && (_jsx(IconButton, { icon: "check-square", ariaLabel: "Select all", onClick: handleSelectAll, size: "small" })), _jsx(IconButton, { icon: "folder-input", ariaLabel: "Move selected", onClick: () => void handleMoveSelected(), size: "small", disabled: !hasSelection }), _jsx(IconButton, { icon: "replace", ariaLabel: "Change note type", onClick: () => void handleChangeNoteType(), size: "small", disabled: !hasSelection }), _jsx(IconButton, { icon: "pause", ariaLabel: "Suspend selected", onClick: () => void handleSuspendSelected(), size: "small", disabled: !hasSelection }), _jsx(IconButton, { icon: "play", ariaLabel: "Unsuspend selected", onClick: () => void handleUnsuspendSelected(), size: "small", disabled: !hasSelection }), _jsx(IconButton, { icon: "rotate-ccw", ariaLabel: "Forget selected", onClick: () => void handleForgetSelected(), size: "small", disabled: !hasSelection }), _jsx(IconButton, { icon: "trash-2", ariaLabel: "Delete selected", onClick: () => void handleDeleteSelected(), size: "small", danger: true, disabled: !hasSelection })] })] }) }));
}
