import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/ui/utils/cn";
export function NoteTypeList({ noteTypes, selectedId, isCreating, onSelect, onCreate, }) {
    const builtins = noteTypes.filter((nt) => nt.isBuiltin);
    const custom = noteTypes.filter((nt) => !nt.isBuiltin);
    return (_jsxs("div", { class: "ep:w-56 ep:border-r ep:border-obs-border ep:flex ep:flex-col ep:shrink-0", children: [_jsxs("div", { class: "ep:flex-1 ep:overflow-y-auto ep:py-1", children: [builtins.map((nt) => (_jsx(NoteTypeItem, { noteType: nt, isSelected: selectedId === nt.id && !isCreating, onSelect: onSelect }, nt.id))), custom.length > 0 && (_jsx("div", { class: "ep:border-t ep:border-obs-border ep:my-1" })), custom.map((nt) => (_jsx(NoteTypeItem, { noteType: nt, isSelected: selectedId === nt.id && !isCreating, onSelect: onSelect }, nt.id)))] }), _jsx("div", { class: "ep:border-t ep:border-obs-border ep:p-2", children: _jsx(Clickable, { class: "ep:w-full ep:text-center ep:py-1.5 ep:px-3 ep:rounded-md ep:text-ui-small ep:text-obs-accent ep:hover:bg-obs-accent/10 ep:transition-colors", onClick: onCreate, children: "+ Add note type" }) })] }));
}
function NoteTypeItem({ noteType, isSelected, onSelect, }) {
    return (_jsxs(Clickable, { class: cn("ep:w-full ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded-md ep:mx-1 ep:transition-colors", isSelected
            ? "ep:bg-obs-accent/10 ep:text-obs-text-normal"
            : "ep:text-obs-muted ep:hover:bg-obs-hover"), onClick: () => onSelect(noteType.id), children: [_jsx("span", { class: "ep:opacity-50 ep:text-ui-smaller", children: noteType.isBuiltin ? "🔒" : "📄" }), _jsx("span", { class: "ep:truncate ep:flex-1", children: noteType.name }), _jsxs("span", { class: "ep:text-ui-smaller ep:opacity-40", children: [noteType.templates.length, "t"] })] }));
}
