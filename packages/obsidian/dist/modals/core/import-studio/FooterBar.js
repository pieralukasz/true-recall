import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
export function FooterBar({ sessionCount, cardCount, detectedFormat, saving, hasSourceNote, onSave, }) {
    const [showHelp, setShowHelp] = useState(false);
    const helpIconRef = useIcon("help-circle");
    return (_jsxs("div", { class: "ep-modal-footer ep:flex ep:items-center ep:gap-2", children: [_jsx("div", { class: "ep:flex ep:items-center ep:gap-2", children: _jsxs("div", { class: "ep:relative ep:flex ep:items-center", children: [_jsx("div", { ref: helpIconRef, role: "button", tabIndex: 0, class: "ep:flex ep:items-center ep:w-3.5 ep:h-3.5 ep:text-obs-faint ep:hover:text-obs-muted ep:cursor-pointer [&>svg]:ep:w-3.5 [&>svg]:ep:h-3.5", onClick: () => setShowHelp((v) => !v), onKeyDown: (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setShowHelp((v) => !v);
                                }
                            } }), showHelp && _jsx(HelpPopover, { onClose: () => setShowHelp(false) })] }) }), _jsx("div", { class: "ep:flex-1 ep:text-ui-smaller ep:text-obs-muted ep:text-center", children: cardCount > 0
                    ? `Format: ${detectedFormat} · ${cardCount} card${cardCount !== 1 ? "s" : ""}`
                    : sessionCount > 0
                        ? `${sessionCount} card${sessionCount !== 1 ? "s" : ""} saved this session`
                        : null }), _jsx(Clickable, { class: "mod-cta ep-btn", onClick: onSave, disabled: cardCount === 0 || saving || !hasSourceNote, stopPropagation: false, children: saving
                    ? "Saving..."
                    : `Save ${cardCount > 0 ? `${cardCount} ` : ""}Card${cardCount !== 1 ? "s" : ""}` })] }));
}
function HelpPopover({ onClose }) {
    const ref = useRef(null);
    const handleOutsideClick = useCallback((e) => {
        if (ref.current && !ref.current.contains(e.target))
            onClose();
    }, [onClose]);
    useEffect(() => {
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [handleOutsideClick]);
    return (_jsxs("div", { ref: ref, class: "ep:absolute ep:left-0 ep:bottom-8 ep:z-50 ep:w-[300px] ep:p-3 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:shadow-lg ep:text-ui-smaller", children: [_jsx("div", { class: "ep:font-semibold ep:mb-2", children: "How to generate flashcards" }), _jsxs("ol", { class: "ep:space-y-1.5 ep:text-obs-muted ep:list-decimal ep:pl-4", children: [_jsx("li", { children: "Paste your note text into any AI chat (ChatGPT, Claude, etc.)" }), _jsx("li", { children: "Ask it to generate flashcards in the format shown below" }), _jsx("li", { children: "Copy the AI response and paste it into the editor above" })] }), _jsxs("div", { class: "ep:mt-2.5 ep:text-obs-faint", children: [_jsx("div", { class: "ep:font-medium ep:text-obs-muted ep:mb-1", children: "Expected format" }), _jsx("pre", { class: "ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-[11px] ep:leading-relaxed ep:whitespace-pre-wrap", children: `#type/basic\nFront: Question\nBack: Answer\n---` })] })] }));
}
