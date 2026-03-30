import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { contextKey } from "@true-recall/core/rag/context/context.types";
import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { ContextChip } from "../context/ContextChip";
import { SuggestionPopup } from "../context/SuggestionPopup";
import { getTriggerRange, useNoteSuggestions, } from "../context/useNoteSuggestions";
export function ChatInput({ onSend, disabled, contextItems, onDismissContext, onAddManualNote, }) {
    const [text, setText] = useState("");
    const textareaRef = useRef(null);
    const sendIconRef = useIcon("send-horizontal");
    const suggestions = useNoteSuggestions();
    const confirmSuggestion = useCallback((file) => {
        const ta = textareaRef.current;
        if (!ta)
            return;
        const range = getTriggerRange(text, ta.selectionStart);
        if (range) {
            const before = text.slice(0, range.start);
            const after = text.slice(range.end);
            setText(before + after);
        }
        suggestions.close();
        onAddManualNote === null || onAddManualNote === void 0 ? void 0 : onAddManualNote({
            kind: "manual-note",
            path: file.path,
            basename: file.basename,
            auto: false,
        });
    }, [text, suggestions, onAddManualNote]);
    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || disabled)
            return;
        onSend(trimmed);
        setText("");
        suggestions.close();
        if (textareaRef.current)
            textareaRef.current.style.height = "auto";
    }, [text, disabled, onSend, suggestions]);
    const handleKeyDown = useCallback((e) => {
        if (suggestions.isActive) {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    suggestions.selectNext();
                    return;
                case "ArrowUp":
                    e.preventDefault();
                    suggestions.selectPrev();
                    return;
                case "Enter": {
                    e.preventDefault();
                    const file = suggestions.confirm();
                    if (file)
                        confirmSuggestion(file);
                    return;
                }
                case "Escape":
                    e.preventDefault();
                    suggestions.close();
                    return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [suggestions, confirmSuggestion, handleSend]);
    const handleInput = useCallback((e) => {
        const target = e.target;
        setText(target.value);
        target.style.height = "auto";
        target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
        suggestions.handleTrigger(target.value, target.selectionStart);
    }, [suggestions]);
    const canSend = text.trim() && !disabled;
    const hasContext = contextItems && contextItems.length > 0;
    return (_jsxs("div", { class: "ep:relative ep:px-2 ep:py-3 ep:border-t ep:border-obs-border", children: [hasContext && (_jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-1 ep:mb-2", children: contextItems.map((item) => {
                    const key = contextKey(item);
                    return (_jsx(ContextChip, { item: item, onDismiss: () => onDismissContext === null || onDismissContext === void 0 ? void 0 : onDismissContext(key) }, key));
                }) })), suggestions.isActive && (_jsx(SuggestionPopup, { suggestions: suggestions.suggestions, highlightIndex: suggestions.highlightIndex, onSelect: confirmSuggestion, onHover: (i) => suggestions.setIndex(i) })), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("textarea", { ref: textareaRef, class: "ep:flex-1 ep:resize-y ep:rounded-xl ep:bg-obs-secondary ep:px-3 ep:py-3 ep:text-obs-normal ep:text-sm ep:outline-none ep:border-none ep:shadow-none ep:appearance-none ep:min-h-[2.5rem] ep:max-h-[200px] ep:leading-normal ep:placeholder:text-obs-muted ep:focus:shadow-none", placeholder: "Ask about your notes... (# to reference)", value: text, onInput: handleInput, onKeyDown: handleKeyDown, disabled: disabled, rows: 1 }), _jsx(Clickable, { class: `ep:flex ep:items-center ep:justify-center ep:shrink-0 ep:transition-colors [&_svg]:ep:w-4 [&_svg]:ep:h-4 ${canSend
                            ? "ep:text-obs-interactive ep:hover:text-obs-interactive-hover"
                            : "ep:text-obs-muted ep:opacity-50"}`, onClick: handleSend, "aria-disabled": !canSend, children: _jsx("span", { ref: sendIconRef }) })] })] }));
}
