import { jsx as _jsx } from "preact/jsx-runtime";
import { clearSearchValue, getSearchValueAfterEscape, } from "@true-recall/obsidian/components/search-input.utils";
import { cn } from "@true-recall/obsidian/utils";
import { SearchComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";
export function SearchInput({ value, placeholder, onChange, autoFocus = false, class: cls, ariaLabel, autoComplete, disabled = false, onFocus, onBlur, onKeyDown, onInputElement, }) {
    const hostRef = useRef(null);
    const componentRef = useRef(null);
    const syncingRef = useRef(false);
    const onChangeRef = useRef(onChange);
    const onFocusRef = useRef(onFocus);
    const onBlurRef = useRef(onBlur);
    const onKeyDownRef = useRef(onKeyDown);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);
    useEffect(() => {
        onFocusRef.current = onFocus;
    }, [onFocus]);
    useEffect(() => {
        onBlurRef.current = onBlur;
    }, [onBlur]);
    useEffect(() => {
        onKeyDownRef.current = onKeyDown;
    }, [onKeyDown]);
    useEffect(() => {
        const hostEl = hostRef.current;
        if (!hostEl)
            return;
        hostEl.innerHTML = "";
        const searchComponent = new SearchComponent(hostEl);
        componentRef.current = searchComponent;
        onInputElement === null || onInputElement === void 0 ? void 0 : onInputElement(searchComponent.inputEl);
        searchComponent.onChange((next) => {
            if (syncingRef.current)
                return;
            onChangeRef.current(next);
        });
        const handleFocus = (event) => {
            var _a;
            (_a = onFocusRef.current) === null || _a === void 0 ? void 0 : _a.call(onFocusRef, event);
        };
        const handleBlur = (event) => {
            var _a;
            (_a = onBlurRef.current) === null || _a === void 0 ? void 0 : _a.call(onBlurRef, event);
        };
        const handleKeyDown = (event) => {
            var _a;
            (_a = onKeyDownRef.current) === null || _a === void 0 ? void 0 : _a.call(onKeyDownRef, event);
            if (event.defaultPrevented)
                return;
            const nextValue = getSearchValueAfterEscape(event.key, searchComponent.getValue());
            if (nextValue !== null) {
                event.preventDefault();
                syncingRef.current = true;
                searchComponent.setValue(clearSearchValue());
                syncingRef.current = false;
                onChangeRef.current(nextValue);
            }
        };
        searchComponent.inputEl.addEventListener("focus", handleFocus);
        searchComponent.inputEl.addEventListener("blur", handleBlur);
        searchComponent.inputEl.addEventListener("keydown", handleKeyDown);
        return () => {
            searchComponent.inputEl.removeEventListener("focus", handleFocus);
            searchComponent.inputEl.removeEventListener("blur", handleBlur);
            searchComponent.inputEl.removeEventListener("keydown", handleKeyDown);
            onInputElement === null || onInputElement === void 0 ? void 0 : onInputElement(null);
            hostEl.innerHTML = "";
            componentRef.current = null;
        };
    }, [onInputElement]);
    useEffect(() => {
        const searchComponent = componentRef.current;
        if (!searchComponent)
            return;
        if (searchComponent.getValue() === value)
            return;
        syncingRef.current = true;
        searchComponent.setValue(value);
        syncingRef.current = false;
    }, [value]);
    useEffect(() => {
        const searchComponent = componentRef.current;
        if (!searchComponent)
            return;
        searchComponent.setPlaceholder(placeholder);
        searchComponent.setDisabled(disabled);
        searchComponent.inputEl.enterKeyHint = "search";
        searchComponent.inputEl.autocapitalize = "off";
        searchComponent.inputEl.spellcheck = false;
        if (ariaLabel !== null && ariaLabel !== void 0 ? ariaLabel : placeholder) {
            searchComponent.inputEl.setAttribute("aria-label", ariaLabel !== null && ariaLabel !== void 0 ? ariaLabel : placeholder);
        }
        if (autoComplete !== undefined) {
            searchComponent.inputEl.setAttribute("autocomplete", autoComplete);
        }
    }, [placeholder, disabled, ariaLabel, autoComplete]);
    useEffect(() => {
        if (!autoFocus)
            return;
        const id = setTimeout(() => { var _a; return (_a = componentRef.current) === null || _a === void 0 ? void 0 : _a.inputEl.focus(); }, 50);
        return () => clearTimeout(id);
    }, [autoFocus]);
    return _jsx("div", { ref: hostRef, class: cn("ep:w-full", cls) });
}
