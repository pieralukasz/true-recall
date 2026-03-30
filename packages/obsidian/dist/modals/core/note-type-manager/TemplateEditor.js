import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { useApp, usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { TemplatePreview } from "./TemplatePreview";
export function TemplateEditor({ template, fields, readOnly, noteTypeType, onTemplateChange, onDelete, isOnlyTemplate, }) {
    return (_jsxs("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:p-3 ep:space-y-3", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("input", { type: "text", class: "ep:flex-1 ep:px-2 ep:py-1 ep:text-ui-small ep:font-medium ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", value: template.name, disabled: readOnly, onBlur: (e) => onTemplateChange(Object.assign(Object.assign({}, template), { name: e.target.value.trim() || template.name })) }), !readOnly && onDelete && (_jsx(Clickable, { class: "ep:text-ui-smaller ep:text-obs-error ep:hover:text-obs-error/80 ep:px-2", onClick: onDelete, disabled: isOnlyTemplate, children: "Delete template" }))] }), _jsx(TemplateCodeEditor, { label: "Front template (qfmt)", value: template.qfmt, readOnly: readOnly, onChange: (val) => onTemplateChange(Object.assign(Object.assign({}, template), { qfmt: val })) }), _jsx(TemplateCodeEditor, { label: "Back template (afmt)", value: template.afmt, readOnly: readOnly, onChange: (val) => onTemplateChange(Object.assign(Object.assign({}, template), { afmt: val })) }), template.afmt.includes("{{FrontSide}}") && (_jsxs("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed", children: [_jsx("code", { class: "ep:text-obs-accent/70", children: `{{FrontSide}}` }), " is an Anki-only feature \u2014 True Recall shows the question separately. You can safely remove it from this template."] })), !readOnly && (_jsxs("div", { class: "ep:flex ep:flex-wrap ep:gap-1.5", children: [_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mr-1", children: "Insert:" }), fields.map((f) => (_jsx(FieldChip, { label: `{{${f}}}` }, f))), noteTypeType === 1 &&
                        fields.map((f) => (_jsx(FieldChip, { label: `{{cloze:${f}}}` }, `cloze-${f}`)))] })), _jsx(TemplatePreview, { template: template, fields: fields, noteTypeType: noteTypeType })] }));
}
function FieldChip({ label }) {
    return (_jsx("span", { class: "ep:text-ui-smaller ep:px-1.5 ep:py-0.5 ep:bg-obs-accent/10 ep:text-obs-accent ep:rounded ep:cursor-default ep:select-all", title: `Copy: ${label}`, children: label }));
}
function TemplateCodeEditor({ label, value, readOnly, onChange, }) {
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
    // Sync external value changes
    useLayoutEffect(() => {
        if (editorRef.current && editorRef.current.value !== value) {
            editorRef.current.set(value);
        }
    }, [value]);
    return (_jsxs("div", { children: [_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-1", children: label }), readOnly || !plugin.EmbeddableEditor ? (_jsx("textarea", { class: "ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:font-mono ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:min-h-[48px] ep:resize-y", value: value, disabled: readOnly, onBlur: (e) => onChange(e.target.value) })) : (_jsx("div", { ref: containerRef, class: "ep:border ep:border-obs-border ep:rounded-md ep:min-h-[48px] ep:overflow-hidden" }))] }));
}
