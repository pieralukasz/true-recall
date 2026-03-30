import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { cva } from "class-variance-authority";
const wrapperVariants = cva("ep-link-count ep:inline-flex ep:items-center ep:gap-0.5 ep:align-middle  ", {
    variants: {
        variant: {
            link: "ep:mt-[1px] ep:text-xs ep:ml-1 ",
            h1: "ep:mb-[3px] ep:ml-2 ep:text-sm ep:opacity-80",
            h2: "ep:mb-[3px] ep:ml-2 ep:text-xs ep:opacity-80",
            h3: "ep:mb-0.5 ep:ml-2 ep:text-[11px] ep:opacity-80",
            h4: "ep:mb-0.5 ep:ml-2 ep:text-[10px] ep:opacity-75",
            h5: "ep:mb-0.5 ep:ml-2 ep:text-[10px] ep:opacity-75",
            h6: "ep:mb-0.5 ep:ml-2 ep:text-[10px] ep:opacity-75",
        },
    },
    defaultVariants: { variant: "link" },
});
const COUNT_CLS = {
    new: `${FSRS_COLORS.new.textCls} ep:tabular-nums`,
    learning: `${FSRS_COLORS.learning.textCls} ep:tabular-nums`,
    due: `${FSRS_COLORS.review.textCls} ep:tabular-nums`,
    muted: "ep:text-obs-muted ep:tabular-nums",
    sep: "ep:text-obs-faint ep:mx-px",
};
export function LinkTextCount({ info, variant }) {
    const parts = [];
    if (info.new > 0)
        parts.push({ count: info.new, label: "new", cls: COUNT_CLS.new });
    if (info.learning > 0)
        parts.push({ count: info.learning, label: "lrn", cls: COUNT_CLS.learning });
    if (info.dueToday > 0)
        parts.push({ count: info.dueToday, label: "due", cls: COUNT_CLS.due });
    const countElements = parts.flatMap((part, i) => {
        const els = [];
        if (i > 0) {
            els.push(_jsx("span", { class: COUNT_CLS.sep, children: "\u00B7" }, `sep-${i}`));
        }
        els.push(_jsxs("span", { class: part.cls, children: [part.count, " ", part.label] }, part.label));
        return els;
    });
    return (_jsxs("span", { class: wrapperVariants({ variant }), title: `Due: ${info.dueToday}, Learning: ${info.learning}, New: ${info.new}, Total: ${info.total}`, children: [countElements, _jsx("span", { class: COUNT_CLS.muted, children: parts.length > 0 ? `(${info.total})` : `(${info.total} cards)` })] }));
}
