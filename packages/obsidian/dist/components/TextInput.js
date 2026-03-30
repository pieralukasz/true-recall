import { jsx as _jsx } from "preact/jsx-runtime";
import { cn } from "@true-recall/obsidian/utils";
import { TextComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";
export function TextInput({ value, onChange, placeholder, type = "text", class: cls, disabled = false, autoFocus = false, ariaLabel, autoComplete, inputMode, enterKeyHint, autoCapitalize, spellcheck, id, name, onKeyDown, onFocus, onBlur, }) {
    const hostRef = useRef(null);
    const componentRef = useRef(null);
    const syncingRef = useRef(false);
    const onChangeRef = useRef(onChange);
    const onKeyDownRef = useRef(onKeyDown);
    const onFocusRef = useRef(onFocus);
    const onBlurRef = useRef(onBlur);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);
    useEffect(() => {
        onKeyDownRef.current = onKeyDown;
    }, [onKeyDown]);
    useEffect(() => {
        onFocusRef.current = onFocus;
    }, [onFocus]);
    useEffect(() => {
        onBlurRef.current = onBlur;
    }, [onBlur]);
    useEffect(() => {
        const hostEl = hostRef.current;
        if (!hostEl)
            return;
        hostEl.innerHTML = "";
        const textComponent = new TextComponent(hostEl);
        componentRef.current = textComponent;
        textComponent.onChange((next) => {
            if (syncingRef.current)
                return;
            onChangeRef.current(next);
        });
        const handleKeyDown = (event) => {
            var _a;
            (_a = onKeyDownRef.current) === null || _a === void 0 ? void 0 : _a.call(onKeyDownRef, event);
        };
        const handleFocus = (event) => {
            var _a;
            (_a = onFocusRef.current) === null || _a === void 0 ? void 0 : _a.call(onFocusRef, event);
        };
        const handleBlur = (event) => {
            var _a;
            (_a = onBlurRef.current) === null || _a === void 0 ? void 0 : _a.call(onBlurRef, event);
        };
        textComponent.inputEl.addEventListener("keydown", handleKeyDown);
        textComponent.inputEl.addEventListener("focus", handleFocus);
        textComponent.inputEl.addEventListener("blur", handleBlur);
        return () => {
            textComponent.inputEl.removeEventListener("keydown", handleKeyDown);
            textComponent.inputEl.removeEventListener("focus", handleFocus);
            textComponent.inputEl.removeEventListener("blur", handleBlur);
            hostEl.innerHTML = "";
            componentRef.current = null;
        };
    }, []);
    useEffect(() => {
        const textComponent = componentRef.current;
        if (!textComponent)
            return;
        if (textComponent.getValue() === value)
            return;
        syncingRef.current = true;
        textComponent.setValue(value);
        syncingRef.current = false;
    }, [value]);
    useEffect(() => {
        var _a;
        const textComponent = componentRef.current;
        if (!textComponent)
            return;
        textComponent.setPlaceholder(placeholder !== null && placeholder !== void 0 ? placeholder : "");
        textComponent.setDisabled(disabled);
        textComponent.inputEl.type = type;
        if (ariaLabel !== null && ariaLabel !== void 0 ? ariaLabel : placeholder) {
            textComponent.inputEl.setAttribute("aria-label", (_a = ariaLabel !== null && ariaLabel !== void 0 ? ariaLabel : placeholder) !== null && _a !== void 0 ? _a : "");
        }
        if (autoComplete !== undefined) {
            textComponent.inputEl.setAttribute("autocomplete", autoComplete);
        }
        if (inputMode !== undefined) {
            textComponent.inputEl.setAttribute("inputmode", inputMode);
        }
        if (enterKeyHint !== undefined) {
            textComponent.inputEl.setAttribute("enterkeyhint", enterKeyHint);
        }
        if (autoCapitalize !== undefined) {
            textComponent.inputEl.autocapitalize = autoCapitalize;
        }
        if (spellcheck !== undefined) {
            textComponent.inputEl.spellcheck = spellcheck;
        }
        if (id !== undefined) {
            textComponent.inputEl.id = id;
        }
        if (name !== undefined) {
            textComponent.inputEl.name = name;
        }
    }, [
        placeholder,
        disabled,
        type,
        ariaLabel,
        autoComplete,
        inputMode,
        enterKeyHint,
        autoCapitalize,
        spellcheck,
        id,
        name,
    ]);
    useEffect(() => {
        if (!autoFocus)
            return;
        const id = setTimeout(() => { var _a; return (_a = componentRef.current) === null || _a === void 0 ? void 0 : _a.inputEl.focus(); }, 50);
        return () => clearTimeout(id);
    }, [autoFocus]);
    return _jsx("div", { ref: hostRef, class: cn("ep:w-full", cls) });
}
