import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { formatEstimatedTime } from "@true-recall/core/helpers/time-estimate";
import { ActionButton } from "@true-recall/obsidian/components";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
export function TodayActionBar({ totalDue, totalNew, totalLearning, estimatedMinutes, progress, }) {
    const plugin = usePlugin();
    const totalActionable = totalDue + totalNew + totalLearning;
    const handleStartReview = () => {
        void plugin.openReviewViewWithFilters({});
    };
    const { studied, minutes, newCards, newCardsCap, reviewCards, reviewsCap } = progress;
    const totalCap = newCardsCap + reviewsCap;
    const newPct = totalCap > 0 ? Math.min(newCards / totalCap, 1) : 0;
    const reviewPct = totalCap > 0 ? Math.min(reviewCards / totalCap, 1) : 0;
    const progressPct = totalCap > 0 ? Math.min(studied / totalCap, 1) : 0;
    const reviewLabel = totalActionable > 0
        ? `Review: ${totalActionable} (~${formatEstimatedTime(estimatedMinutes)})`
        : "All caught up!";
    const counts = [];
    if (totalDue > 0)
        counts.push({
            value: totalDue,
            label: "due",
            colorCls: FSRS_COLORS.review.textCls,
        });
    if (totalNew > 0)
        counts.push({
            value: totalNew,
            label: "new",
            colorCls: FSRS_COLORS.new.textCls,
        });
    if (totalLearning > 0)
        counts.push({
            value: totalLearning,
            label: "lrn",
            colorCls: FSRS_COLORS.learning.textCls,
        });
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3 ep:rounded-lg ep:border ep:border-obs-border/30 ep:bg-surface-raised ep:shadow-raised ep:p-4", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:gap-3", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [counts.map((c) => (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:rounded-md ep:bg-obs-secondary/50 ep:px-3 ep:py-1.5", children: [_jsx("span", { class: `ep:text-lg ep:font-semibold ${c.colorCls}`, children: c.value }), _jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted", children: c.label })] }, c.label))), totalActionable === 0 && (_jsx("span", { class: "ep:text-sm ep:text-obs-muted", children: "Nothing to review" }))] }), _jsx(ActionButton, { label: reviewLabel, variant: "primary", onClick: handleStartReview, disabled: totalActionable === 0 })] }), _jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1.5", children: [_jsxs("div", { class: "ep:h-1.5 ep:rounded-full ep:bg-obs-secondary ep:overflow-hidden ep:flex", children: [newPct > 0 && (_jsx("div", { class: "ep:h-full ep:transition-all ep:duration-300", style: {
                                    width: `${newPct * 100}%`,
                                    backgroundColor: `var(${FSRS_COLORS.new.cssVar})`,
                                } })), reviewPct > 0 && (_jsx("div", { class: "ep:h-full ep:transition-all ep:duration-300", style: {
                                    width: `${reviewPct * 100}%`,
                                    backgroundColor: `var(${FSRS_COLORS.review.cssVar})`,
                                } })), progressPct > newPct + reviewPct && (_jsx("div", { class: "ep:h-full ep:transition-all ep:duration-300", style: {
                                    width: `${(progressPct - newPct - reviewPct) * 100}%`,
                                    backgroundColor: `var(${FSRS_COLORS.learning.cssVar})`,
                                } }))] }), studied > 0 && (_jsxs("span", { class: "ep:text-ui-smaller ep:text-obs-muted", children: [studied, " studied", minutes > 0 && ` · ${minutes} min`] }))] })] }));
}
