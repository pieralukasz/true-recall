import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
export function ChartCard({ title, subtitle, children }) {
    return (_jsxs("div", { class: "ep:rounded-lg ep:border ep:border-obs-modifier-border ep:bg-obs-primary ep:p-4", children: [_jsxs("div", { class: "ep:mb-3", children: [_jsx("h3", { class: "ep:text-sm ep:font-semibold ep:text-obs-normal", children: title }), subtitle && (_jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:mt-0.5", children: subtitle }))] }), children] }));
}
