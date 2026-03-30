import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";
const SHORT_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function StreakWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        var _a, _b, _c;
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const streakInfo = statsCalc.getStreakInfo();
        const todaySummary = statsCalc.getTodaySummary();
        const allStats = statsCalc.getAllDailyStats();
        // Build week dots (Mon-Sun for current week)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
        // Convert to Mon=0 based
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekDots = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - mondayOffset + i);
            const dateStr = (_a = date.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
            const stats = allStats[dateStr];
            const active = ((_b = stats === null || stats === void 0 ? void 0 : stats.reviewsCompleted) !== null && _b !== void 0 ? _b : 0) > 0;
            const isToday = i === mondayOffset;
            weekDots.push({ label: (_c = SHORT_DAY_NAMES[i]) !== null && _c !== void 0 ? _c : "", active, isToday });
        }
        return {
            current: streakInfo.current,
            longest: streakInfo.longest,
            todayCorrectRate: todaySummary.correctRate,
            todayStudied: todaySummary.studied,
            weekDots,
        };
    }).value;
    if (!data) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    const showLongest = configValue(config, "showLongest", true);
    const showWeekDots = configValue(config, "showWeekDots", true);
    const showTodayRate = configValue(config, "showTodayRate", true);
    const handleReviewClick = () => {
        plugin.openCustomStudyModal().catch(() => { });
    };
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-3 ep:flex-wrap ep:text-xs", children: [_jsxs("span", { class: "ep:font-semibold", children: [data.current, "d streak"] }), showLongest && data.longest > 0 && (_jsxs("span", { class: "ep:text-obs-muted", children: ["(longest: ", data.longest, "d)"] })), showTodayRate && data.todayStudied > 0 && (_jsxs("span", { children: [Math.round(data.todayCorrectRate * 100), "% today"] })), showTodayRate && data.todayStudied === 0 && (_jsx("span", { class: "ep:text-obs-muted", children: "No reviews today" })), _jsx("span", { class: "ep:ml-auto", children: _jsx(WidgetCta, { label: "Review \u2192", onClick: handleReviewClick }) })] }), showWeekDots && (_jsx("div", { class: "ep:flex ep:items-center ep:gap-3 ep:text-xs", children: data.weekDots.map((dot) => (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:gap-0.5", children: [_jsx("span", { class: dot.isToday ? "ep:font-semibold" : "ep:text-obs-muted", children: dot.label }), _jsx("span", { class: `ep:text-sm ${dot.active
                                ? "ep:text-obs-green"
                                : dot.isToday
                                    ? "ep:text-obs-muted ep:animate-pulse"
                                    : "ep:text-obs-faint"}`, children: dot.active ? "●" : "○" })] }, dot.label))) }))] }));
}
