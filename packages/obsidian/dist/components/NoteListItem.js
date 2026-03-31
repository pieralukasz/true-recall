import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { cn } from "@true-recall/obsidian/utils";
const BASE_CLS = "ep:flex ep:w-full ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group ep:text-left ep:bg-transparent";
const SUGGESTED_CLS = "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive ep:rounded-lg ep:mb-1";
export function NoteListItem({ note, onSelect, isSuggested, }) {
    var _a;
    const folderPath = (_a = note.parent) === null || _a === void 0 ? void 0 : _a.path;
    return (_jsx("button", { type: "button", class: cn(BASE_CLS, isSuggested && SUGGESTED_CLS), onClick: onSelect, children: _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1", children: [_jsx("span", { class: "ep:shrink-0", children: "\u{1F4C4}" }), _jsx("span", { class: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap", children: note.basename }), folderPath && folderPath !== "/" && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2", children: folderPath }))] }) }));
}
