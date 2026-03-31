import { jsx as _jsx } from "preact/jsx-runtime";
import { withSectionLabels, } from "@true-recall/obsidian/components/search-combobox.utils";
import { replaceTokenAtCursor } from "@true-recall/obsidian/helpers/search-suggestions";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/ui/utils/cn";
import { AbstractInputSuggest, SearchComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";
class SearchComboboxSuggest extends AbstractInputSuggest {
    constructor(app, inputEl, getList, onPick) {
        super(app, inputEl);
        this.getList = getList;
        this.onPick = onPick;
        this.limit = 200;
    }
    getSuggestions(query) {
        return this.getList(query);
    }
    renderSuggestion(value, el) {
        el.textContent = "";
        if (value.showSectionLabel) {
            const sectionEl = el.ownerDocument.createElement("div");
            sectionEl.className = "true-recall-search-suggest-section";
            sectionEl.textContent = value.sectionLabel;
            el.appendChild(sectionEl);
        }
        const titleEl = el.ownerDocument.createElement("div");
        titleEl.className = "suggestion-title";
        titleEl.textContent = value.label;
        el.appendChild(titleEl);
        if (value.description) {
            const noteEl = el.ownerDocument.createElement("div");
            noteEl.className = "suggestion-note";
            noteEl.textContent = value.description;
            el.appendChild(noteEl);
        }
    }
    selectSuggestion(value, evt) {
        this.onPick(value, evt);
        this.close();
    }
}
export function SearchCombobox({ value, placeholder, onChange, getSuggestions, autoFocus = false, class: cls, ariaLabel, }) {
    const app = useApp();
    const hostRef = useRef(null);
    const searchRef = useRef(null);
    const suggestRef = useRef(null);
    const onChangeRef = useRef(onChange);
    const getSuggestionsRef = useRef(getSuggestions);
    const syncingRef = useRef(false);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);
    useEffect(() => {
        getSuggestionsRef.current = getSuggestions;
    }, [getSuggestions]);
    useEffect(() => {
        const hostEl = hostRef.current;
        if (!hostEl)
            return;
        hostEl.innerHTML = "";
        const searchComponent = new SearchComponent(hostEl);
        searchRef.current = searchComponent;
        searchComponent.onChange((next) => {
            if (syncingRef.current)
                return;
            onChangeRef.current(next);
        });
        if (getSuggestionsRef.current) {
            const suggest = new SearchComboboxSuggest(app, searchComponent.inputEl, (query) => {
                var _a, _b, _c;
                const cursorPos = (_a = searchComponent.inputEl.selectionStart) !== null && _a !== void 0 ? _a : query.length;
                const suggestions = (_c = (_b = getSuggestionsRef.current) === null || _b === void 0 ? void 0 : _b.call(getSuggestionsRef, query, cursorPos)) !== null && _c !== void 0 ? _c : [];
                return withSectionLabels(suggestions);
            }, (suggestion) => {
                var _a;
                const inputEl = searchComponent.inputEl;
                const cursorPos = (_a = inputEl.selectionStart) !== null && _a !== void 0 ? _a : inputEl.value.length;
                const { text, cursor } = replaceTokenAtCursor(inputEl.value, cursorPos, suggestion.insertText);
                syncingRef.current = true;
                searchComponent.setValue(text);
                syncingRef.current = false;
                onChangeRef.current(text);
                requestAnimationFrame(() => {
                    var _a;
                    const nextInput = (_a = searchRef.current) === null || _a === void 0 ? void 0 : _a.inputEl;
                    if (!nextInput)
                        return;
                    nextInput.focus();
                    nextInput.setSelectionRange(cursor, cursor);
                });
            });
            suggestRef.current = suggest;
        }
        const handleKeyDown = (event) => {
            var _a;
            if (event.key !== "Escape")
                return;
            const currentValue = searchComponent.getValue();
            if (currentValue.length > 0) {
                event.preventDefault();
                syncingRef.current = true;
                searchComponent.setValue("");
                syncingRef.current = false;
                onChangeRef.current("");
                return;
            }
            (_a = suggestRef.current) === null || _a === void 0 ? void 0 : _a.close();
        };
        searchComponent.inputEl.addEventListener("keydown", handleKeyDown);
        return () => {
            var _a;
            searchComponent.inputEl.removeEventListener("keydown", handleKeyDown);
            (_a = suggestRef.current) === null || _a === void 0 ? void 0 : _a.close();
            hostEl.innerHTML = "";
            suggestRef.current = null;
            searchRef.current = null;
        };
    }, [app]);
    useEffect(() => {
        const searchComponent = searchRef.current;
        if (!searchComponent)
            return;
        if (searchComponent.getValue() === value)
            return;
        syncingRef.current = true;
        searchComponent.setValue(value);
        syncingRef.current = false;
    }, [value]);
    useEffect(() => {
        const searchComponent = searchRef.current;
        if (!searchComponent)
            return;
        searchComponent.setPlaceholder(placeholder);
        searchComponent.inputEl.enterKeyHint = "search";
        searchComponent.inputEl.autocapitalize = "off";
        searchComponent.inputEl.spellcheck = false;
        searchComponent.inputEl.setAttribute("aria-label", ariaLabel !== null && ariaLabel !== void 0 ? ariaLabel : placeholder);
    }, [placeholder, ariaLabel]);
    useEffect(() => {
        if (!autoFocus)
            return;
        const id = setTimeout(() => { var _a; return (_a = searchRef.current) === null || _a === void 0 ? void 0 : _a.inputEl.focus(); }, 50);
        return () => clearTimeout(id);
    }, [autoFocus]);
    return _jsx("div", { ref: hostRef, class: cn("ep:w-full", cls) });
}
