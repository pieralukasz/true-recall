import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { cva } from "class-variance-authority";
const reviewStatVariants = cva("ep:font-bold", {
    variants: {
        type: {
            new: "ep:text-obs-green",
            learning: "ep:text-obs-orange",
            due: "ep:text-obs-blue",
        },
    },
});
function ReviewStat({ label, type, count, }) {
    return (_jsxs("span", { class: "ep:flex ep:items-center ep:gap-1.5", children: [_jsx("span", { class: "ep:text-obs-muted", children: label }), _jsx("span", { class: reviewStatVariants({ type }), children: count })] }));
}
function Dot() {
    return _jsx("span", { class: "ep:text-obs-faint ep:mx-1", children: "\u00B7" });
}
export function ReviewHeader({ review, showStats, crammingMode, }) {
    if (!showStats)
        return null;
    const counts = review.getBadgeCounts();
    return (_jsx("div", { class: "ep:flex ep:justify-center ep:items-center ep:relative ep:shrink-0 ep:p-2 ep:pb-4", children: _jsxs("div", { class: "ep:flex ep:items-center ep:text-ui-smaller ep:font-medium", children: [_jsx(ReviewStat, { label: "New", type: "new", count: counts.new }), _jsx(Dot, {}), _jsx(ReviewStat, { label: "Learning", type: "learning", count: counts.learning }), _jsx(Dot, {}), _jsx(ReviewStat, { label: "Due", type: "due", count: counts.due }), crammingMode && (_jsxs(_Fragment, { children: [_jsx(Dot, {}), _jsx("span", { class: "ep:flex ep:items-center ep:justify-center ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ep:bg-obs-orange/20 ep:text-obs-orange", children: "Cram" })] }))] }) }));
}
