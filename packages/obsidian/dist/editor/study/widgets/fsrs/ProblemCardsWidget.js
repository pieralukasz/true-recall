import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";
const PROBLEM_BADGES = {
    high_lapses: { label: "leech", color: "var(--color-red)" },
    low_stability: { label: "unstable", color: "var(--color-orange)" },
    relearning: { label: "relearning", color: "var(--color-yellow)" },
};
function getMetricLabel(card) {
    switch (card.problemType) {
        case "high_lapses":
            return `${card.lapses} lapses`;
        case "low_stability":
            return `S: ${card.stability.toFixed(1)}`;
        case "relearning":
            return `D: ${card.difficulty.toFixed(1)}`;
    }
}
export function ProblemCardsWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const limit = configValue(config, "limit", 5);
    const showType = configValue(config, "showType", true);
    const data = useComputed(() => {
        var _a;
        void cards.value;
        if (!((_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.stats))
            return null;
        return plugin.cardStore.stats.getProblemCards(limit);
    }).value;
    if (!data) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    if (data.length === 0) {
        return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:p-3 ep:text-xs", children: [_jsx("span", { style: { color: "var(--color-green)" }, children: "\u2713" }), _jsx("span", { class: "ep:text-obs-muted", children: "All cards healthy!" })] }));
    }
    const handleReview = () => {
        plugin
            .openReviewViewWithFilters({
            overdueOnly: true,
            ignoreDailyLimits: true,
        })
            .catch(() => { });
    };
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1.5 ep:p-3 ep:text-xs", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:mb-0.5", children: [_jsx("span", { class: "ep:font-semibold", children: "Problem Cards" }), _jsxs("span", { class: "ep:text-obs-muted", children: [data.length, " found"] })] }), data.map((card) => {
                const badge = PROBLEM_BADGES[card.problemType];
                return (_jsxs(Clickable, { class: "ep:flex ep:items-center ep:gap-2 ep:rounded ep:px-1.5 ep:py-1 hover:ep:bg-obs-modifier-hover", onClick: handleReview, title: card.question, children: [_jsx("span", { class: "ep:flex-1 ep:truncate ep:min-w-0", children: truncateQuestion(card.question) }), showType && (_jsx("span", { class: "ep:shrink-0 ep:px-1.5 ep:py-0.5 ep:rounded ep:text-[10px] ep:font-medium", style: {
                                color: badge.color,
                                backgroundColor: `color-mix(in srgb, ${badge.color} 12%, transparent)`,
                            }, children: badge.label })), _jsx("span", { class: "ep:shrink-0 ep:text-obs-muted ep:text-[10px] ep:w-16 ep:text-right", children: getMetricLabel(card) })] }, card.id));
            }), _jsx("div", { class: "ep:flex ep:justify-end ep:pt-1", children: _jsx(WidgetCta, { label: "Review problem cards \u2192", onClick: handleReview }) })] }));
}
function truncateQuestion(q) {
    const clean = q.replace(/\n/g, " ").trim();
    if (clean.length <= 40)
        return clean;
    return `${clean.slice(0, 37)}...`;
}
