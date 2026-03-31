import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { SearchInput } from "@true-recall/obsidian/components/SearchInput";
import { extractBacklinks, noteHasTagPrefix, } from "@true-recall/obsidian/modals/shared/move-card/move-card.utils";
import { filterNotesByQuery, MAX_DISPLAY_NOTES, } from "@true-recall/obsidian/modals/shared/note-filter.utils";
import { useCallback, useState } from "preact/hooks";
function NoteItem({ note, isSuggested, onSelect, }) {
    var _a;
    const baseCls = "ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group";
    const suggestedCls = "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive ep:rounded-lg ep:mb-1";
    const folderPath = (_a = note.parent) === null || _a === void 0 ? void 0 : _a.path;
    return (_jsxs("div", { class: isSuggested ? `${baseCls} ${suggestedCls}` : baseCls, role: "option", tabIndex: 0, onClick: () => onSelect(note.path), onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(note.path);
            }
        }, children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1", children: [_jsx("span", { class: "ep:shrink-0", children: isSuggested ? "\u{1F4A1}" : "\u{1F4C4}" }), _jsx("span", { class: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap", children: note.basename }), folderPath && folderPath !== "/" && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2", children: folderPath }))] }), _jsx(Clickable, { class: "ep:shrink-0 ep:py-1 ep:px-3 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:text-ui-smaller ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100", onClick: () => onSelect(note.path), children: "Select" })] }));
}
export function MoveCardBody({ allNotes, app, cardQuestion, cardAnswer, onResolve, }) {
    const [searchQuery, setSearchQuery] = useState("");
    const handleSelect = useCallback((path) => {
        onResolve({ cancelled: false, targetNotePath: path });
    }, [onResolve]);
    const backlinks = extractBacklinks(cardQuestion, cardAnswer);
    const suggestedNotes = backlinks.length > 0
        ? allNotes.filter((note) => backlinks.some((link) => note.basename.toLowerCase() === link.toLowerCase()))
        : [];
    const filteredNotes = (() => {
        if (searchQuery.startsWith("#")) {
            const tagPrefix = searchQuery.slice(1).toLowerCase();
            return [...allNotes]
                .filter((note) => noteHasTagPrefix(app, note, tagPrefix))
                .sort((a, b) => b.stat.mtime - a.stat.mtime);
        }
        return filterNotesByQuery(allNotes, searchQuery);
    })();
    const displayNotes = filteredNotes.slice(0, MAX_DISPLAY_NOTES);
    const emptyText = searchQuery
        ? searchQuery.startsWith("#")
            ? `No notes found with tag ${searchQuery}.`
            : "No notes found matching your search."
        : "No notes available.";
    return (_jsxs(_Fragment, { children: [_jsx("p", { class: "ep:text-obs-muted ep:text-ui-small ep:mb-4", children: "Select a note to move the flashcard(s) to. A flashcard file will be created if it doesn't exist." }), _jsx(SearchInput, { value: searchQuery, onChange: setSearchQuery, placeholder: "Search notes or #tags...", ariaLabel: "Search notes or tags", autoFocus: true, class: "ep:mb-3" }), suggestedNotes.length > 0 && (_jsxs("div", { class: "ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border", children: [_jsx("h4", { class: "ep:text-ui-smaller ep:text-obs-muted ep:m-0 ep:mb-2", children: "Suggested (from backlinks)" }), suggestedNotes.map((note) => (_jsx(NoteItem, { note: note, isSuggested: true, onSelect: handleSelect }, note.path)))] })), _jsx("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto", style: "max-height: 350px", children: filteredNotes.length === 0 ? (_jsx("div", { class: "ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic", children: emptyText })) : (_jsxs(_Fragment, { children: [displayNotes.map((note) => (_jsx(NoteItem, { note: note, onSelect: handleSelect }, note.path))), filteredNotes.length > MAX_DISPLAY_NOTES && (_jsxs("div", { class: "ep:p-3 ep:text-center ep:text-obs-muted ep:text-ui-smaller", children: ["Showing ", MAX_DISPLAY_NOTES, " of ", filteredNotes.length, " notes. Type to search for more."] }))] })) })] }));
}
