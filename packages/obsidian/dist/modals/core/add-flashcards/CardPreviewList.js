import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
import { BUILTIN_CLOZE_ID } from "@true-recall/core/types/note.types";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { useState } from "preact/hooks";
const COLLAPSED_COUNT = 5;
export function CardPreviewList({ cards, duplicateCount = 0, }) {
    const [expanded, setExpanded] = useState(false);
    if (cards.length === 0)
        return null;
    const basicCount = cards.filter((c) => c.noteTypeId !== BUILTIN_CLOZE_ID).length;
    const clozeCount = cards.filter((c) => c.noteTypeId === BUILTIN_CLOZE_ID).length;
    const shown = expanded ? cards : cards.slice(0, COLLAPSED_COUNT);
    const hiddenCount = cards.length - COLLAPSED_COUNT;
    return (_jsxs("div", { class: "ep:space-y-2", children: [_jsxs("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: ["Detected: ", cards.length, " card", cards.length !== 1 ? "s" : "", clozeCount > 0 && basicCount > 0 && (_jsxs("span", { children: [" ", "(", basicCount, " Basic, ", clozeCount, " Cloze)"] })), duplicateCount > 0 && (_jsxs("span", { class: "ep:text-obs-faint", children: [" ", "\u00B7 ", duplicateCount, " duplicate", duplicateCount !== 1 ? "s" : "", " ", "removed"] }))] }), _jsxs("div", { class: "ep:max-h-[200px] ep:overflow-y-auto ep:space-y-1", children: [shown.map((card, i) => {
                        var _a, _b;
                        return (_jsx(CardPreviewItem, { card: card, index: i }, `card-${i}-${(_b = (_a = Object.values(card.fields)[0]) === null || _a === void 0 ? void 0 : _a.slice(0, 30)) !== null && _b !== void 0 ? _b : i}`));
                    }), hiddenCount > 0 && !expanded && (_jsxs(Clickable, { class: "ep:text-ui-smaller ep:text-obs-faint ep:hover:text-obs-muted ep:px-2 ep:py-1", onClick: () => setExpanded(true), children: ["+", hiddenCount, " more card", hiddenCount !== 1 ? "s" : ""] }))] })] }));
}
function CardPreviewItem({ card, index }) {
    var _a, _b;
    const isCloze = card.noteTypeId === BUILTIN_CLOZE_ID;
    const fieldEntries = Object.entries(card.fields);
    const isMultiField = fieldEntries.length > 2;
    return (_jsxs("div", { class: "ep:flex ep:items-start ep:gap-2 ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-ui-smaller", children: [_jsxs("span", { class: "ep:text-obs-faint ep:shrink-0 ep:tabular-nums ep:w-5 ep:text-right", children: [index + 1, "."] }), _jsx("div", { class: "ep:flex-1 ep:min-w-0", children: isCloze ? (_jsx("span", { class: "ep:text-obs-normal ep:line-clamp-2", children: card.fields.Text })) : isMultiField ? (_jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-x-3 ep:gap-y-0.5", children: fieldEntries.map(([key, value]) => (_jsxs("span", { class: "ep:line-clamp-1", children: [_jsxs("span", { class: "ep:text-obs-faint", children: [key, ": "] }), _jsx("span", { class: "ep:text-obs-normal", children: value })] }, key))) })) : (_jsxs("span", { class: "ep:text-obs-normal ep:line-clamp-1", children: [(_a = fieldEntries[0]) === null || _a === void 0 ? void 0 : _a[1], _jsx("span", { class: "ep:text-obs-faint ep:mx-1", children: "\u2192" }), (_b = fieldEntries[1]) === null || _b === void 0 ? void 0 : _b[1]] })) }), isCloze && (_jsx("span", { class: "ep:shrink-0 ep:px-1 ep:py-0.5 ep:text-[10px] ep:bg-obs-accent/10 ep:text-obs-accent ep:rounded", children: "Cloze" }))] }));
}
