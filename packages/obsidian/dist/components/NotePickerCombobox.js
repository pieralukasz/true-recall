import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { SearchInput } from "@true-recall/obsidian/components/SearchInput";
import { filterNotesByQuery, MAX_DISPLAY_NOTES, } from "@true-recall/obsidian/modals/shared/note-filter.utils";
import { cn } from "@true-recall/ui/utils/cn";
import { useCallback, useEffect, useMemo, useRef, useState, } from "preact/hooks";
export function NotePickerCombobox({ app, selectedNote, onSelect, }) {
    var _a;
    const listRef = useRef(null);
    const [inputValue, setInputValue] = useState((_a = selectedNote === null || selectedNote === void 0 ? void 0 : selectedNote.basename) !== null && _a !== void 0 ? _a : "");
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const allNotes = useMemo(() => app.vault.getMarkdownFiles(), [app]);
    const filtered = useMemo(() => filterNotesByQuery(allNotes, query).slice(0, MAX_DISPLAY_NOTES), [allNotes, query]);
    // Sync input text when selectedNote changes externally.
    useEffect(() => {
        var _a;
        setInputValue((_a = selectedNote === null || selectedNote === void 0 ? void 0 : selectedNote.basename) !== null && _a !== void 0 ? _a : "");
    }, [selectedNote]);
    const selectNote = useCallback((file) => {
        onSelect(file);
        setInputValue(file.basename);
        setQuery("");
        setIsOpen(false);
        setHighlightIndex(-1);
    }, [onSelect]);
    const handleInput = useCallback((value) => {
        setInputValue(value);
        setQuery(value);
        setIsOpen(true);
        setHighlightIndex(-1);
    }, []);
    const handleFocus = useCallback(() => {
        setIsOpen(true);
    }, []);
    const handleBlur = useCallback((e) => {
        var _a, _b;
        // Don't close if focus moved to dropdown items
        const related = e.relatedTarget;
        if (related && ((_a = listRef.current) === null || _a === void 0 ? void 0 : _a.contains(related)))
            return;
        // Restore previous selection on blur without new selection
        setInputValue((_b = selectedNote === null || selectedNote === void 0 ? void 0 : selectedNote.basename) !== null && _b !== void 0 ? _b : "");
        setIsOpen(false);
        setQuery("");
        setHighlightIndex(-1);
    }, [selectedNote]);
    const handleKeyDown = useCallback((e) => {
        var _a;
        if (!isOpen && e.key !== "ArrowDown" && e.key !== "ArrowUp")
            return;
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                    setHighlightIndex(0);
                }
                else {
                    setHighlightIndex((prev) => prev < filtered.length - 1 ? prev + 1 : 0);
                }
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightIndex((prev) => prev > 0 ? prev - 1 : filtered.length - 1);
                break;
            case "Enter": {
                e.preventDefault();
                const target = filtered[highlightIndex];
                if (highlightIndex >= 0 && target) {
                    selectNote(target);
                }
                break;
            }
            case "Escape":
                e.preventDefault();
                setIsOpen(false);
                setHighlightIndex(-1);
                setInputValue((_a = selectedNote === null || selectedNote === void 0 ? void 0 : selectedNote.basename) !== null && _a !== void 0 ? _a : "");
                setQuery("");
                break;
        }
    }, [isOpen, filtered, highlightIndex, selectNote, selectedNote]);
    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIndex < 0 || !listRef.current)
            return;
        const item = listRef.current.children[highlightIndex];
        item === null || item === void 0 ? void 0 : item.scrollIntoView({ block: "nearest" });
    }, [highlightIndex]);
    return (_jsxs("div", { class: "ep:relative", children: [_jsx(SearchInput, { value: inputValue, placeholder: "Search notes...", ariaLabel: "Search notes", onChange: handleInput, onFocus: handleFocus, onBlur: handleBlur, onKeyDown: handleKeyDown, autoComplete: "off" }), isOpen && filtered.length > 0 && (_jsx("ul", { ref: listRef, class: cn("ep:absolute ep:right-0 ep:top-full ep:mt-1 ep:z-50", "ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg", "ep:max-h-[280px] ep:overflow-y-auto ep:py-1 ep:min-w-full ep:w-[420px] ep:max-w-[90vw]"), children: filtered.map((note, index) => {
                    var _a;
                    const folderPath = (_a = note.parent) === null || _a === void 0 ? void 0 : _a.path;
                    return (_jsxs("li", { tabIndex: -1, class: cn("ep:px-3 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-2", highlightIndex === index
                            ? "ep:bg-obs-modifier-hover ep:text-obs-normal"
                            : "ep:text-obs-muted"), onMouseDown: (e) => {
                            e.preventDefault();
                            selectNote(note);
                        }, onMouseEnter: () => setHighlightIndex(index), children: [_jsx("span", { class: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap ep:shrink", children: note.basename }), folderPath && folderPath !== "/" && (_jsx("span", { class: "ep:text-[11px] ep:text-obs-faint ep:shrink-0", children: folderPath }))] }, note.path));
                }) }))] }));
}
