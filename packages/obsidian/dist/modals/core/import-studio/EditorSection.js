import { jsx as _jsx } from "preact/jsx-runtime";
import { placeholder } from "@codemirror/view";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { useCallback, useEffect, useRef } from "preact/hooks";
import { buildPlaceholder } from "./placeholder";
const BLANK_CARD_TEMPLATE = "#type/basic\nFront: \nBack: \n\n---\n";
const CURSOR_OFFSET_AFTER_FRONT = "#type/basic\nFront: ".length;
function insertBlankCard(view) {
    const { from } = view.state.selection.main;
    // If not at line start, prepend a newline
    const line = view.state.doc.lineAt(from);
    const prefix = from === line.from ? "" : "\n";
    const insert = prefix + BLANK_CARD_TEMPLATE;
    const cursorPos = from + prefix.length + CURSOR_OFFSET_AFTER_FRONT;
    view.dispatch({
        changes: { from, insert },
        selection: { anchor: cursorPos },
    });
    return true;
}
export function EditorSection({ app, text, onTextChange, onEditorReady, onEditorFocus, onModEnter, }) {
    const plugin = usePlugin();
    const editorContainerRef = useRef(null);
    const editorRef = useRef(null);
    const onTextChangeRef = useRef(onTextChange);
    const onEditorReadyRef = useRef(onEditorReady);
    const onEditorFocusRef = useRef(onEditorFocus);
    const onModEnterRef = useRef(onModEnter);
    onTextChangeRef.current = onTextChange;
    onEditorReadyRef.current = onEditorReady;
    onEditorFocusRef.current = onEditorFocus;
    onModEnterRef.current = onModEnter;
    useEffect(() => {
        const el = editorContainerRef.current;
        if (!el || !plugin.EmbeddableEditor)
            return;
        let editor;
        try {
            editor = new plugin.EmbeddableEditor(app, el, {
                onChange: (update) => onTextChangeRef.current(update.state.doc.toString()),
                onModEnter: () => onModEnterRef.current(),
                extraExtensions: [placeholder(buildPlaceholder())],
            });
        }
        catch (err) {
            console.error("[ImportStudioApp] Failed to create editor:", err);
            return;
        }
        editorRef.current = editor;
        onEditorReadyRef.current(editor);
        onEditorFocusRef.current(editor.cm);
        const onFocusIn = () => {
            onEditorFocusRef.current(editor.cm);
        };
        const onKeyDown = (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && (e.key === "3" || e.code === "Digit3")) {
                e.preventDefault();
                e.stopPropagation();
                insertBlankCard(editor.cm);
            }
        };
        editor.cm.contentDOM.addEventListener("focusin", onFocusIn);
        el.addEventListener("keydown", onKeyDown, true);
        editor.cm.focus();
        return () => {
            el.removeEventListener("keydown", onKeyDown, true);
            editor.cm.contentDOM.removeEventListener("focusin", onFocusIn);
            editorRef.current = null;
            onEditorReadyRef.current(null);
            editor.destroy();
        };
    }, [app, plugin.EmbeddableEditor]);
    if (!plugin.EmbeddableEditor) {
        return (_jsx("textarea", { class: "ep:w-full ep:min-h-[400px] ep:px-3 ep:py-2 ep:text-ui-small ep:font-mono ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:resize-y ep:placeholder-obs-faint", placeholder: buildPlaceholder(), value: text, onInput: (e) => onTextChange(e.target.value), onKeyDown: (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    onModEnter();
                }
                if ((e.metaKey || e.ctrlKey) && e.key === "3") {
                    e.preventDefault();
                    const ta = e.target;
                    const pos = ta.selectionStart;
                    const before = ta.value.slice(0, pos);
                    const after = ta.value.slice(ta.selectionEnd);
                    const prefix = pos > 0 && !before.endsWith("\n") ? "\n" : "";
                    const insert = prefix + BLANK_CARD_TEMPLATE;
                    onTextChange(before + insert + after);
                    requestAnimationFrame(() => {
                        const cursor = pos + prefix.length + CURSOR_OFFSET_AFTER_FRONT;
                        ta.setSelectionRange(cursor, cursor);
                    });
                }
            } }));
    }
    const focusEditor = useCallback((e) => {
        const editor = editorRef.current;
        if (!editor)
            return;
        const target = e.target;
        if (!target.closest(".cm-content")) {
            editor.cm.focus();
        }
    }, []);
    return (_jsx("div", { role: "textbox", tabIndex: 0, ref: editorContainerRef, onClick: focusEditor, onKeyDown: focusEditor, class: "true-recall-import-editor ep:w-full ep:min-h-[400px] ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden" }));
}
