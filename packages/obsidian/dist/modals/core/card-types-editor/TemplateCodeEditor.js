import { jsx as _jsx } from "preact/jsx-runtime";
import { useApp, usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
export function TemplateCodeEditor({ value, readOnly, onChange, tall, }) {
    const app = useApp();
    const plugin = usePlugin();
    const containerRef = useRef(null);
    const editorRef = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !plugin.EmbeddableEditor || readOnly)
            return;
        const editor = new plugin.EmbeddableEditor(app, el, {
            value,
            onBlur: (ed) => onChangeRef.current(ed.value),
        });
        editorRef.current = editor;
        return () => {
            editorRef.current = null;
            editor.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only recreate editor on mount or readOnly change; value sync handled separately
    }, [app, plugin.EmbeddableEditor, readOnly]);
    useLayoutEffect(() => {
        if (editorRef.current && editorRef.current.value !== value) {
            editorRef.current.set(value);
        }
    }, [value]);
    const heightCls = tall ? "ep:h-full" : "ep:min-h-[48px]";
    return readOnly || !plugin.EmbeddableEditor ? (_jsx("textarea", { class: `ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:font-mono ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:resize-y ${heightCls}`, value: value, disabled: readOnly, onBlur: (e) => onChange(e.target.value) })) : (_jsx("div", { ref: containerRef, class: `ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden ${heightCls}` }));
}
