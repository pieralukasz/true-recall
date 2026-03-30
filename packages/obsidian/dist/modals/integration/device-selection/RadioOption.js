import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
export function RadioOption({ value, label, description, checked, onChange, }) {
    return (_jsxs(Clickable, { stopPropagation: false, class: `ep:flex ep:items-start ep:gap-3 ep:p-3 ep:rounded-md ep:mb-2 ep:cursor-pointer ep:bg-obs-secondary ep:transition-colors ep:hover:bg-obs-modifier-hover ep:border-none ep:font-inherit ep:text-left ep:w-full ${checked ? "ep-radio-active" : ""}`, onClick: () => onChange(), children: [_jsx("input", { type: "radio", name: "device-action", value: value, checked: checked, class: "ep:mt-0.5 ep:shrink-0", onChange: onChange, onClick: (e) => e.stopPropagation() }), _jsxs("div", { children: [_jsx("div", { class: "ep:font-medium", children: label }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mt-0.5", children: description })] })] }));
}
