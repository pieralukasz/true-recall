import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
export function ChartLegend({ simulations, }) {
    return (_jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-3 ep:mb-4 ep:justify-end", children: simulations.map((sim) => (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1.5", children: [_jsx("div", { class: "ep:w-4 ep:h-4 ep:rounded-sm ep-dynamic-bg", style: { "--ep-dynamic-color": sim.color } }), _jsx("span", { class: "ep:text-ui-small ep:text-obs-muted", children: sim.sequence })] }, sim.sequence))) }));
}
