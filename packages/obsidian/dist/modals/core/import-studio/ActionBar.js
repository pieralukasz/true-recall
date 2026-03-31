import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { NotePickerCombobox } from "@true-recall/obsidian/components/NotePickerCombobox";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
export function ActionBar({ app, selectedSourceNote, onSourceSelect, }) {
    const [showHelp, setShowHelp] = useState(false);
    const helpIconRef = useIcon("help-circle");
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("div", { class: "ep:flex-1", children: _jsx(NotePickerCombobox, { app: app, selectedNote: selectedSourceNote, onSelect: onSourceSelect }) }), _jsxs("div", { class: "ep:relative ep:flex ep:items-center", children: [_jsx("div", { ref: helpIconRef, role: "button", tabIndex: 0, class: "ep:flex ep:items-center ep:text-obs-faint ep:hover:text-obs-muted ep:cursor-pointer [&>svg]:ep:w-4 [&>svg]:ep:h-4", onClick: () => setShowHelp((v) => !v), onKeyDown: (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setShowHelp((v) => !v);
                            }
                        } }), showHelp && _jsx(FormatHelpPopover, { onClose: () => setShowHelp(false) })] })] }));
}
function FormatHelpPopover({ onClose }) {
    const ref = useRef(null);
    const handleOutsideClick = useCallback((e) => {
        if (ref.current && !ref.current.contains(e.target))
            onClose();
    }, [onClose]);
    useEffect(() => {
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [handleOutsideClick]);
    return (_jsxs("div", { ref: ref, class: "ep:absolute ep:right-0 ep:top-8 ep:z-50 ep:w-[280px] ep:p-3 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:shadow-lg ep:text-ui-smaller", children: [_jsx("div", { class: "ep:font-semibold ep:mb-2", children: "Expected format" }), _jsx("pre", { class: "ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-[11px] ep:leading-relaxed ep:whitespace-pre-wrap", children: `#type/basic\nFront: Question\nBack: Answer\n---` }), _jsxs("div", { class: "ep:mt-2 ep:text-obs-muted ep:space-y-1", children: [_jsxs("div", { children: ["Each card starts with", " ", _jsx("code", { class: "ep:text-obs-normal", children: "#type/basic" })] }), _jsxs("div", { children: ["Separate cards with ", _jsx("code", { class: "ep:text-obs-normal", children: "---" })] })] })] }));
}
