import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { renderTemplate } from "@true-recall/core/services/cards/template-engine";
import { Clickable } from "@true-recall/obsidian/components";
import { MarkdownContent } from "@true-recall/obsidian/components/MarkdownContent";
import { useMemo, useState } from "preact/hooks";
export function TemplatePreview({ template, fields, noteTypeType, }) {
    const [showPreview, setShowPreview] = useState(false);
    const sampleFields = useMemo(() => {
        const result = {};
        for (const f of fields) {
            result[f] = noteTypeType === 1 ? `{{c1::sample ${f} text}}` : `(${f})`;
        }
        return result;
    }, [fields, noteTypeType]);
    const renderedFront = useMemo(() => renderTemplate(template.qfmt, {
        fields: sampleFields,
        clozeIndex: 1,
    }), [template.qfmt, sampleFields]);
    const renderedBack = useMemo(() => renderTemplate(template.afmt, {
        fields: sampleFields,
        frontSide: "",
        clozeIndex: 1,
    }), [template.afmt, sampleFields]);
    return (_jsxs("div", { class: "ep:mt-2", children: [_jsx(Clickable, { class: "ep:text-ui-smaller ep:text-obs-accent ep:hover:text-obs-accent/80", onClick: () => setShowPreview((v) => !v), children: showPreview ? "Hide preview" : "Show preview" }), showPreview && (_jsxs("div", { class: "ep:mt-2 ep:border ep:border-obs-border ep:rounded-md ep:p-3 ep:bg-obs-primary/50", children: [_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:uppercase ep:tracking-wider", children: "Front" }), _jsx(MarkdownContent, { markdown: renderedFront, class: "ep:mb-3 ep:text-ui-small" }), _jsx("div", { class: "ep:border-t ep:border-obs-border ep:my-2" }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:uppercase ep:tracking-wider", children: "Back" }), _jsx(MarkdownContent, { markdown: renderedBack, class: "ep:text-ui-small" })] }))] }));
}
