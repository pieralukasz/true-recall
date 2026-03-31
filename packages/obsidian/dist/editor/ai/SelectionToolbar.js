import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { useCallback, useState } from "preact/hooks";
export function SelectionToolbar({ selectedText, onGenerate, onEdit, onQuickAdd, onDismiss, onHighlight, hasApiKey, detectedImagePath, onImageOcclusion, }) {
    const [copied, setCopied] = useState(false);
    const handleGenerate = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!hasApiKey)
            return;
        onDismiss();
        yield onGenerate();
    }), [hasApiKey, onGenerate, onDismiss]);
    const handleQuickAdd = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        onDismiss();
        yield onQuickAdd();
    }), [onQuickAdd, onDismiss]);
    const handleEdit = useCallback(() => {
        onDismiss();
        onEdit();
    }, [onEdit, onDismiss]);
    const handleCopy = useCallback(() => {
        void navigator.clipboard.writeText(selectedText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [selectedText]);
    const handleHighlight = useCallback(() => {
        onHighlight();
        onDismiss();
    }, [onHighlight, onDismiss]);
    return (_jsxs("div", { class: "true-recall-selection-toolbar ep:flex ep:items-center ep:gap-0.5 ep:p-1", children: [_jsx(Clickable, { class: `true-recall-st-btn ${!hasApiKey ? "true-recall-st-btn-disabled" : ""}`, disabled: !hasApiKey, onClick: () => void handleGenerate(), title: hasApiKey
                    ? "Generate flashcard(s) with AI"
                    : "Add an OpenRouter API key in settings", children: _jsx("span", { children: "Flashcards" }) }), _jsx("span", { class: "true-recall-st-divider" }), detectedImagePath && onImageOcclusion && (_jsx(Clickable, { class: "true-recall-st-btn", onClick: () => {
                    onDismiss();
                    onImageOcclusion(detectedImagePath);
                }, title: "Create image occlusion card", children: _jsx("span", { children: "IO" }) })), _jsx(Clickable, { class: "true-recall-st-btn", onClick: handleEdit, title: "Open in flashcard editor", children: _jsx("span", { children: "Edit" }) }), _jsx(Clickable, { class: "true-recall-st-btn", onClick: () => void handleQuickAdd(), title: "Quick add as basic flashcard", children: _jsx("span", { children: "Quick+" }) }), _jsx("span", { class: "true-recall-st-divider" }), _jsx(Clickable, { class: "true-recall-st-btn", onClick: handleHighlight, title: "Wrap selection with ==highlight==", children: _jsx("span", { children: "Highlight" }) }), _jsx(Clickable, { class: "true-recall-st-btn", onClick: handleCopy, title: copied ? "Copied!" : "Copy selection", children: _jsx("span", { children: copied ? "Copied!" : "Copy" }) })] }));
}
