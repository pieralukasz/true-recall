import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";
function getIntensity(streak) {
    if (streak === 0)
        return "none";
    if (streak < 5)
        return "low";
    if (streak < 10)
        return "medium";
    if (streak < 25)
        return "high";
    return "max";
}
const INTENSITY_COLORS = {
    none: "var(--text-muted)",
    low: "var(--color-green)",
    medium: "var(--color-yellow)",
    high: "var(--color-orange)",
    max: "var(--color-red)",
};
const FLAMES = {
    none: "",
    low: "\u{1F525}",
    medium: "\u{1F525}\u{1F525}",
    high: "\u{1F525}\u{1F525}\u{1F525}",
    max: "\u{1F525}\u{1F525}\u{1F525}\u{1F525}",
};
export function AnswerStreakWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        var _a;
        void cards.value;
        const stats = (_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.stats;
        if (!stats)
            return null;
        return stats.getAnswerStreakInfo();
    }).value;
    if (!data)
        return null;
    const showBest = configValue(config, "showBest", true);
    const showToday = configValue(config, "showToday", true);
    const handleClick = () => {
        plugin.openCustomStudyModal().catch(() => { });
    };
    if (data.current === 0 && data.todayBest === 0 && data.allTimeBest === 0) {
        return (_jsxs(Clickable, { class: "ep:flex ep:items-center ep:gap-3 ep:p-3 ep:text-xs", onClick: handleClick, children: [_jsx("span", { class: "ep:text-obs-muted", children: "Start reviewing to build your streak!" }), _jsx("span", { class: "ep:ml-auto", children: _jsx(WidgetCta, { label: "Review \\u2192", onClick: handleClick }) })] }));
    }
    const intensity = getIntensity(data.current);
    const color = INTENSITY_COLORS[intensity];
    const flames = FLAMES[intensity];
    return (_jsxs(Clickable, { class: "ep:flex ep:items-center ep:gap-2 ep:p-3 ep:text-sm ep:flex-wrap", onClick: handleClick, children: [flames && _jsx("span", { children: flames }), _jsx("span", { class: "ep:text-lg ep:font-bold", style: { color }, children: data.current }), _jsx("span", { class: "ep:text-xs ep:text-obs-muted", children: "correct" }), showToday && data.todayBest > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { class: "ep:text-obs-faint", children: "\u00B7" }), _jsxs("span", { class: "ep:text-xs ep:text-obs-muted", children: ["today: ", data.todayBest] })] })), showBest && data.allTimeBest > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { class: "ep:text-obs-faint", children: "\u00B7" }), _jsxs("span", { class: "ep:text-xs ep:text-obs-muted", children: ["best: ", data.allTimeBest] })] })), _jsx("span", { class: "ep:ml-auto", children: _jsx(WidgetCta, { label: "Review \\u2192", onClick: handleClick }) })] }));
}
