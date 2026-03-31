import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
export function CardTypeDropdown({ templates, selectedIndex, onChange, }) {
    return (_jsx("select", { class: "ep:flex-1 ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", value: selectedIndex, onChange: (e) => onChange(Number(e.target.value)), children: templates.map((t, i) => (_jsxs("option", { value: i, children: [i + 1, ": ", t.name] }, t.ordinal))) }));
}
