import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { useApp, usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, } from "preact/hooks";
export function NoteFieldsForm({ noteType, fields, onFieldChange, onFieldFocus, onModEnter, onEscape, autoFocusFirst = true, pinnedFields, onTogglePin, }) {
    const editorsRef = useRef(new Map());
    const registerEditor = useCallback((name, editor) => {
        if (editor)
            editorsRef.current.set(name, editor);
        else
            editorsRef.current.delete(name);
    }, []);
    const focusField = useCallback((fieldName, direction) => {
        const fieldNames = noteType.fields;
        const idx = fieldNames.indexOf(fieldName);
        const nextIdx = idx + direction;
        if (nextIdx >= 0 && nextIdx < fieldNames.length) {
            const nextField = fieldNames[nextIdx];
            if (nextField) {
                const nextEditor = editorsRef.current.get(nextField);
                nextEditor === null || nextEditor === void 0 ? void 0 : nextEditor.cm.focus();
            }
        }
    }, [noteType.fields]);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3", children: [noteType.fields.map((fieldName, idx) => {
                var _a, _b;
                return (_jsx(CMField, { fieldName: fieldName, content: (_a = fields[fieldName]) !== null && _a !== void 0 ? _a : "", autoFocus: autoFocusFirst && idx === 0, onFieldChange: onFieldChange, onFieldFocus: onFieldFocus, onModEnter: onModEnter, onEscape: onEscape, isPinned: (_b = pinnedFields === null || pinnedFields === void 0 ? void 0 : pinnedFields.has(fieldName)) !== null && _b !== void 0 ? _b : false, onTogglePin: onTogglePin, registerEditor: registerEditor, onTab: () => focusField(fieldName, 1), onShiftTab: () => focusField(fieldName, -1) }, fieldName));
            }), noteType.type === 1 && (_jsxs("div", { class: "ep:text-ui-smaller ep:text-obs-faint ep:bg-obs-secondary ep:px-3 ep:py-2 ep:border ep:border-obs-border ep:rounded-md", children: ["Use ", _jsx("code", { class: "ep:text-obs-accent", children: "{{c1::text}}" }), " syntax for cloze deletions. Multiple indices create multiple cards."] }))] }));
}
function CMField({ fieldName, content, autoFocus, onFieldChange, onFieldFocus, onModEnter, onEscape, isPinned, onTogglePin, registerEditor, onTab, onShiftTab, }) {
    const app = useApp();
    const plugin = usePlugin();
    const containerRef = useRef(null);
    const editorRef = useRef(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const shouldFocusRef = useRef(false);
    const pinIconRef = useIcon("pin");
    // Track current content for blur handler without triggering editor recreation
    const contentRef = useRef(content);
    contentRef.current = content;
    const handleBlur = useCallback((e) => onFieldChange(fieldName, e.value), [fieldName, onFieldChange]);
    const handleModEnter = useCallback(() => onModEnter === null || onModEnter === void 0 ? void 0 : onModEnter(), [onModEnter]);
    // Debounced doc-change listener — updates fields state as user types (~150ms)
    // so hasContent / Save button react without waiting for blur.
    // Added via StateEffect.appendConfig (after construction) because
    // EmbeddableEditor.onChange has a timing bug in buildLocalExtensions.
    const debounceRef = useRef();
    const onFieldChangeRef = useRef(onFieldChange);
    onFieldChangeRef.current = onFieldChange;
    const [editorFailed, setEditorFailed] = useState(false);
    // Stable deps — editor is only recreated if app or EmbeddableEditor class changes.
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !plugin.EmbeddableEditor || isCollapsed)
            return;
        let editor;
        try {
            editor = new plugin.EmbeddableEditor(app, el, {
                value: contentRef.current,
                onBlur: handleBlur,
                onEscape: () => onEscape === null || onEscape === void 0 ? void 0 : onEscape(),
                onModEnter: handleModEnter,
                onTab: onTab ? () => onTab() : undefined,
                onShiftTab: onShiftTab ? () => onShiftTab() : undefined,
            });
        }
        catch (err) {
            console.error("[CMField] Failed to create editor:", err);
            setEditorFailed(true);
            return;
        }
        editorRef.current = editor;
        registerEditor === null || registerEditor === void 0 ? void 0 : registerEditor(fieldName, editor);
        // CM6 updateListener — catches all doc changes (type, delete, paste, undo)
        editor.cm.dispatch({
            effects: StateEffect.appendConfig.of(EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                        onFieldChangeRef.current(fieldName, update.state.doc.toString());
                    }, 150);
                }
            })),
        });
        // Report focus to parent for shared toolbar
        editor.cm.contentDOM.addEventListener("focusin", () => {
            onFieldFocus === null || onFieldFocus === void 0 ? void 0 : onFieldFocus(fieldName, editor.cm);
        });
        if (autoFocus || shouldFocusRef.current) {
            shouldFocusRef.current = false;
            const endPos = editor.cm.state.doc.length;
            editor.cm.dispatch({ selection: { anchor: endPos } });
            editor.cm.focus();
        }
        return () => {
            clearTimeout(debounceRef.current);
            registerEditor === null || registerEditor === void 0 ? void 0 : registerEditor(fieldName, null);
            editorRef.current = null;
            editor.destroy();
        };
    }, [app, plugin.EmbeddableEditor, isCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps -- only recreate editor on mount, collapse toggle, or editor class change; value sync handled by separate effect
    // Sync content when parent updates fields (e.g. NoteType switch resets values).
    // useLayoutEffect prevents a visible flash of stale content.
    useLayoutEffect(() => {
        const editor = editorRef.current;
        if (!editor || editor.value === content)
            return;
        editor.set(content);
    }, [content]);
    const header = (_jsxs(Clickable, { class: "ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:cursor-pointer ep:select-none ep:group", onClick: () => {
            setIsCollapsed((v) => {
                if (v)
                    shouldFocusRef.current = true;
                return !v;
            });
        }, children: [_jsx("span", { class: "ep:text-obs-faint ep:text-ui-smaller ep:w-3 ep:shrink-0", children: isCollapsed ? "▸" : "▾" }), _jsx("span", { class: "ep:text-ui-small ep:font-medium ep:text-obs-normal ep:flex-1", children: fieldName }), onTogglePin && (_jsx(Clickable, { ref: pinIconRef, title: isPinned
                    ? "Unpin field (content kept on Save & Add)"
                    : "Pin field (keep content on Save & Add)", class: `ep:w-4 ep:h-4 ep:cursor-pointer ep:transition-colors [&>svg]:ep:w-3.5 [&>svg]:ep:h-3.5 ${isPinned
                    ? "ep:text-obs-accent"
                    : "ep:text-obs-faint ep:opacity-50 ep:hover:opacity-100"}`, onClick: (e) => {
                    e.stopPropagation();
                    onTogglePin(fieldName);
                } }))] }));
    // Fallback: render plain textarea until EmbeddableEditor is available or if creation failed
    if (!plugin.EmbeddableEditor || editorFailed) {
        return (_jsxs("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden", children: [header, !isCollapsed && (_jsx("textarea", { class: "ep:w-full ep:px-3 ep:py-2 ep:text-ui-small ep:bg-obs-primary ep:min-h-[2.25rem] ep:resize-y", value: content, onInput: (e) => onFieldChange(fieldName, e.target.value) }))] }));
    }
    return (_jsxs("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden", children: [header, !isCollapsed && (_jsx("div", { ref: containerRef, class: "true-recall-add-field ep:w-full ep:min-h-[1.6em] ep:bg-obs-primary ep:overflow-hidden ep:px-3 ep:py-2" }))] }));
}
