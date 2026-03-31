import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { NoteListItem } from "@true-recall/obsidian/components/NoteListItem";
import { SearchInput } from "@true-recall/obsidian/components/SearchInput";
import { useMemo, useState } from "preact/hooks";
export function NotePicker({ notes, onSelect, onCancel, maxResults = 50, title, suggestedPaths, }) {
    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search.trim())
            return notes.slice(0, maxResults);
        const q = search.toLowerCase();
        return notes
            .filter((n) => n.basename.toLowerCase().includes(q))
            .slice(0, maxResults);
    }, [notes, search, maxResults]);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2", children: [title && (_jsx("h4", { class: "ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0", children: title })), _jsx(SearchInput, { value: search, onChange: setSearch, placeholder: "Search notes...", ariaLabel: "Search notes" }), _jsx("div", { class: "ep:max-h-[200px] ep:overflow-y-auto ep:border ep:border-obs-border ep:rounded-md", children: filtered.length === 0 ? (_jsx("div", { class: "ep:p-3 ep:text-ui-small ep:text-obs-muted ep:text-center", children: "No notes found" })) : (filtered.map((note) => (_jsx(NoteListItem, { note: note, onSelect: () => onSelect(note), isSuggested: suggestedPaths === null || suggestedPaths === void 0 ? void 0 : suggestedPaths.has(note.path) }, note.path)))) }), onCancel && (_jsx(Clickable, { class: "ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border-none ep:self-start", onClick: onCancel, children: "Cancel" }))] }));
}
