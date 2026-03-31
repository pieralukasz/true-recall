import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable, SearchInput } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { filterNotesByQuery, MAX_DISPLAY_NOTES, } from "@true-recall/obsidian/modals/shared/note-filter.utils";
import { normalizePath } from "obsidian";
import { render } from "preact";
import { useState } from "preact/hooks";
function SelectNoteBody({ allNotes, description, onResolve, }) {
    const [searchQuery, setSearchQuery] = useState("");
    const filteredNotes = filterNotesByQuery(allNotes, searchQuery);
    const displayNotes = filteredNotes.slice(0, MAX_DISPLAY_NOTES);
    const emptyText = searchQuery
        ? "No notes found matching your search."
        : "No notes available.";
    return (_jsxs(_Fragment, { children: [_jsx("p", { class: "ep:text-obs-muted ep:text-ui-small ep:mb-4", children: description !== null && description !== void 0 ? description : "Select a note." }), _jsx("div", { class: "ep:mb-3", children: _jsx(SearchInput, { autoFocus: true, value: searchQuery, placeholder: "Search notes...", ariaLabel: "Search notes", onChange: setSearchQuery }) }), _jsx("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto", style: "max-height: 350px", children: displayNotes.length === 0 ? (_jsx("div", { class: "ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic", children: emptyText })) : (_jsxs(_Fragment, { children: [displayNotes.map((note) => {
                            var _a;
                            const folderPath = (_a = note.parent) === null || _a === void 0 ? void 0 : _a.path;
                            return (_jsxs(Clickable, { class: "ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:text-left ep:w-full ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group", onClick: () => onResolve({
                                    cancelled: false,
                                    selectedNote: note,
                                }), stopPropagation: false, children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1", children: [_jsx("span", { class: "ep:shrink-0", children: "\uD83D\uDCC4" }), _jsx("span", { class: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap", children: note.basename }), folderPath && folderPath !== "/" && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2", children: folderPath }))] }), _jsx("span", { class: "ep:shrink-0 ep:py-1 ep:px-3 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:text-ui-smaller ep:opacity-0 ep:group-hover:opacity-100", children: "Select" })] }, note.path));
                        }), filteredNotes.length > MAX_DISPLAY_NOTES && (_jsxs("div", { class: "ep:p-3 ep:text-center ep:text-obs-muted ep:text-ui-small", children: ["Showing ", MAX_DISPLAY_NOTES, " of ", filteredNotes.length, " notes. Type to search for more."] }))] })) })] }));
}
export class SelectNoteModal extends BasePromiseModal {
    constructor(app, options = {}) {
        var _a;
        super(app, {
            title: (_a = options.title) !== null && _a !== void 0 ? _a : "Select Note",
            width: "500px",
        });
        this.allNotes = [];
        this.options = options;
    }
    getDefaultResult() {
        return { cancelled: true, selectedNote: null };
    }
    onOpen() {
        super.onOpen();
        this.contentEl.addClass("true-recall-select-note-modal");
        this.allNotes = this.getValidNotes();
    }
    renderBody(container) {
        render(_jsx(SelectNoteBody, { allNotes: this.allNotes, description: this.options.description, onResolve: (result) => this.resolve(result) }), container);
    }
    getValidNotes() {
        const excludeFolder = this.options.excludeFolder
            ? normalizePath(this.options.excludeFolder)
            : null;
        const excludePaths = this.options.excludePaths;
        return this.app.vault.getMarkdownFiles().filter((file) => {
            if (excludeFolder && file.path.startsWith(`${excludeFolder}/`)) {
                return false;
            }
            if (excludePaths === null || excludePaths === void 0 ? void 0 : excludePaths.has(file.path)) {
                return false;
            }
            return true;
        });
    }
}
