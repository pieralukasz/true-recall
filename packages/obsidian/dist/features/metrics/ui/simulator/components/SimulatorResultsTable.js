import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
export function SimulatorResultsTable({ simulations, }) {
    const maxReviews = Math.max(...simulations.map((s) => s.reviews.length), 1);
    const headerCellCls = [
        "ep:py-2 ep:px-3",
        "ep:text-left ep:font-semibold",
        "ep:text-obs-muted ep:text-ui-smaller ep:uppercase",
        "ep:border-b ep:border-obs-border",
    ].join(" ");
    const bodyCellCls = "ep:py-2 ep:px-3 ep:text-obs-normal";
    return (_jsx("div", { class: "ep:bg-obs-secondary ep:rounded-lg ep:p-4", children: _jsxs("table", { class: "ep:w-full ep:text-ui-small", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { class: headerCellCls, children: "Grade" }), Array.from({ length: maxReviews }, (_, i) => (_jsxs("th", { class: headerCellCls, children: ["Ivl-", i] }, `ivl-${i}`)))] }) }), _jsx("tbody", { children: simulations.map((sim) => (_jsxs("tr", { class: "ep:border-b ep:border-obs-border last:ep:border-b-0", children: [_jsx("td", { class: bodyCellCls, children: _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("div", { class: "ep:w-3 ep:h-3 ep:rounded-full ep:flex-shrink-0 ep-dynamic-bg", style: { "--ep-dynamic-color": sim.color } }), _jsx("span", { class: "ep:font-mono", children: sim.sequence })] }) }), Array.from({ length: maxReviews }, (_, i) => {
                                const review = sim.reviews[i];
                                const interval = review ? Math.round(review.interval) : "-";
                                return (_jsx("td", { class: `${bodyCellCls} ep:text-center ep:font-mono`, children: interval }, `${sim.sequence}-ivl-${i}`));
                            })] }, sim.sequence))) })] }) }));
}
