import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { useCallback } from "preact/hooks";
export function ImageToolbar({ onQuickAdd, onEdit, onImageOcclusion, onDismiss, }) {
    const handleQuickAdd = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        onDismiss();
        yield onQuickAdd();
    }), [onQuickAdd, onDismiss]);
    const handleEdit = useCallback(() => {
        onDismiss();
        onEdit();
    }, [onEdit, onDismiss]);
    const handleIO = useCallback(() => {
        onDismiss();
        onImageOcclusion();
    }, [onImageOcclusion, onDismiss]);
    return (_jsxs("div", { class: "true-recall-selection-toolbar ep:flex ep:items-center ep:gap-0.5 ep:p-1", children: [_jsx(Clickable, { class: "true-recall-st-btn", onClick: handleIO, title: "Create image occlusion card", children: _jsx("span", { children: "IO" }) }), _jsx("span", { class: "true-recall-st-divider" }), _jsx(Clickable, { class: "true-recall-st-btn", onClick: handleEdit, title: "Open in flashcard editor with image", children: _jsx("span", { children: "Edit" }) }), _jsx(Clickable, { class: "true-recall-st-btn", onClick: () => void handleQuickAdd(), title: "Quick add image as flashcard question", children: _jsx("span", { children: "Quick+" }) })] }));
}
