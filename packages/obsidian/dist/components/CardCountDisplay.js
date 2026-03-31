import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "preact/jsx-runtime";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { cva } from "class-variance-authority";
const cardCountVariants = cva("ep:flex ep:items-center ep:gap-1", {
    variants: {
        size: {
            smaller: "ep:text-ui-smaller",
            small: "ep:text-ui-small",
        },
        bold: {
            true: "ep:font-medium",
        },
    },
    defaultVariants: { size: "smaller", bold: true },
});
export function CardCountDisplay({ newCount, learningCount, dueCount, totalCount, variant = "full", size = "smaller", bold = true, }) {
    return (_jsxs("span", { class: cardCountVariants({ size, bold }), children: [_jsx("span", { class: FSRS_COLORS.new.textCls, children: newCount }), _jsx("span", { class: "ep:text-obs-faint", children: "\u00B7" }), variant === "full" && (_jsxs(_Fragment, { children: [_jsx("span", { class: FSRS_COLORS.learning.textCls, children: learningCount }), _jsx("span", { class: "ep:text-obs-faint", children: "\u00B7" })] })), _jsx("span", { class: FSRS_COLORS.review.textCls, children: dueCount }), totalCount !== undefined && (_jsxs("span", { class: "ep:text-obs-faint", children: [" (", totalCount, ")"] }))] }));
}
