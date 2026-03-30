import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
export function OptionCheckbox({ label, description, checked, onChange, }) {
    return (_jsxs("div", { class: "ep:flex ep:items-start ep:gap-3 ep:py-2", children: [_jsx("input", { type: "checkbox", class: "ep:w-4 ep:h-4 ep:accent-obs-interactive ep:shrink-0 ep:mt-0.5", checked: checked, onChange: () => onChange(!checked) }), _jsxs("div", { children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium", children: label }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: description })] })] }));
}
