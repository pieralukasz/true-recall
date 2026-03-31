import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
export function FieldChips({ fields, noteTypeType }) {
    return (_jsxs("div", { class: "ep:flex ep:flex-wrap ep:gap-1.5 ep:pt-2", children: [_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mr-1", children: "Insert:" }), fields.map((f) => (_jsx(Chip, { label: `{{${f}}}` }, f))), noteTypeType === 1 &&
                fields.map((f) => _jsx(Chip, { label: `{{cloze:${f}}}` }, `cloze-${f}`))] }));
}
function Chip({ label }) {
    return (_jsx("span", { class: "ep:text-ui-smaller ep:px-1.5 ep:py-0.5 ep:bg-obs-accent/10 ep:text-obs-accent ep:rounded ep:cursor-default ep:select-all", title: `Copy: ${label}`, children: label }));
}
