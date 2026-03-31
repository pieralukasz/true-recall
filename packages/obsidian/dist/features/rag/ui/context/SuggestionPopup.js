import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useIcon } from "@true-recall/obsidian/preact";
import { cn } from "@true-recall/ui/utils/cn";
import { useEffect, useRef } from "preact/hooks";
function SuggestionItem({ note, highlighted, onSelect, onHover, }) {
    var _a;
    const iconRef = useIcon("file-text");
    const folderPath = (_a = note.parent) === null || _a === void 0 ? void 0 : _a.path;
    return (_jsxs("li", { class: cn("ep:px-2.5 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-1.5", highlighted
            ? "ep:bg-obs-modifier-hover ep:text-obs-normal"
            : "ep:text-obs-muted"), onMouseDown: (e) => {
            e.preventDefault();
            onSelect(note);
        }, onMouseEnter: onHover, children: [_jsx("span", { ref: iconRef, class: "ep:shrink-0 ep:flex ep:items-center [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5" }), _jsx("span", { class: "ep:font-medium ep:truncate ep:min-w-0", children: note.basename }), folderPath && folderPath !== "/" && (_jsx("span", { class: "ep:text-[11px] ep:text-obs-faint ep:shrink-0 ep:ml-auto", children: folderPath }))] }));
}
export function SuggestionPopup({ suggestions, highlightIndex, onSelect, onHover, }) {
    const listRef = useRef(null);
    useEffect(() => {
        if (highlightIndex < 0 || !listRef.current)
            return;
        const item = listRef.current.children[highlightIndex];
        item === null || item === void 0 ? void 0 : item.scrollIntoView({ block: "nearest" });
    }, [highlightIndex]);
    return (_jsx("ul", { ref: listRef, class: cn("ep:absolute ep:bottom-full ep:left-0 ep:mb-1 ep:z-50", "ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg", "ep:max-h-[200px] ep:overflow-y-auto ep:py-1 ep:w-full"), children: suggestions.map((note, index) => (_jsx(SuggestionItem, { note: note, highlighted: highlightIndex === index, onSelect: onSelect, onHover: () => onHover(index) }, note.path))) }));
}
