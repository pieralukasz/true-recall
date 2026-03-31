import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { WorkloadForecastCalculator } from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function WorkloadWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        var _a;
        void cards.value;
        if (!plugin.cardStore || !plugin.sessionPersistence)
            return null;
        const forecastDays = configValue(config, "days", 14);
        const heavyThreshold = configValue(config, "heavyThreshold", 1.5);
        const overrideMinPerCard = config.minutesPerCard;
        const forecast = new WorkloadForecastCalculator(plugin.cardStore);
        const entries = forecast.getForecast(forecastDays);
        const summary = forecast.getSummary(30, forecastDays);
        // Calculate time per card from recent stats
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const todaySummary = statsCalc.getTodaySummary();
        const minPerCard = typeof overrideMinPerCard === "number"
            ? overrideMinPerCard
            : todaySummary.studied > 0
                ? todaySummary.minutes / todaySummary.studied
                : 0.5; // default ~30s per card
        const avgDaily = summary.avgDaily;
        const minCount = Math.min(...entries.map((e) => e.dueCount));
        const today = new Date().toISOString().split("T")[0];
        const days = entries.map((entry, idx) => {
            var _a;
            const entryDate = new Date(entry.date);
            const label = entry.date === today ? "Today" : ((_a = DAY_NAMES[entryDate.getDay()]) !== null && _a !== void 0 ? _a : "");
            return {
                label,
                count: entry.dueCount,
                estimatedMinutes: Math.round(entry.dueCount * minPerCard),
                isToday: entry.date === today,
                isHeavy: avgDaily > 0 && entry.dueCount > avgDaily * heavyThreshold,
                isLightest: entry.dueCount === minCount && entry.dueCount < avgDaily,
                daysAhead: idx,
            };
        });
        const firstEntry = entries[0];
        if (!firstEntry)
            return {
                days,
                avgDaily: 0,
                peakDay: { label: "", count: 0 },
                needsBalancing: false,
            };
        const peakEntry = entries.reduce((max, e) => (e.dueCount > max.dueCount ? e : max), firstEntry);
        const peakDate = new Date(peakEntry.date);
        const peakLabel = peakEntry.date === today ? "Today" : ((_a = DAY_NAMES[peakDate.getDay()]) !== null && _a !== void 0 ? _a : "");
        return {
            days,
            avgDaily: Math.round(avgDaily),
            peakDay: { label: peakLabel, count: peakEntry.dueCount },
            needsBalancing: summary.needsBalancing,
        };
    }).value;
    if (!data || data.days.length === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No forecast data." }));
    }
    const showTime = configValue(config, "showTime", true);
    const showFlags = configValue(config, "showFlags", true);
    const maxCount = Math.max(1, ...data.days.map((d) => d.count));
    const handleTodayReview = () => {
        plugin.openCustomStudyModal().catch(() => { });
    };
    const handleDayClick = (daysAhead) => {
        if (daysAhead === 0) {
            handleTodayReview();
            return;
        }
        plugin
            .openReviewViewWithFilters({
            studyAheadDays: daysAhead,
            ignoreDailyLimits: true,
        })
            .catch(() => { });
    };
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsxs("span", { class: "ep:font-semibold", children: ["Workload Planner (", configValue(config, "days", 14), " days)"] }), _jsxs("span", { class: "ep:text-obs-muted", children: ["avg: ", data.avgDaily, " cards/day"] })] }), _jsx("div", { class: "ep:flex ep:flex-col ep:gap-1", children: data.days.map((day) => (_jsxs(Clickable, { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs hover:ep:bg-obs-modifier-hover ep:rounded ep:px-1 ep:py-0.5", onClick: () => handleDayClick(day.daysAhead), title: day.isToday
                        ? "Start review"
                        : `Study ahead: ${day.daysAhead} days`, children: [_jsx("span", { class: `ep:w-10 ep:text-right ${day.isToday ? "ep:font-semibold" : "ep:text-obs-muted"}`, children: day.label }), _jsx("div", { class: "ep:flex-1 ep:h-3 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden", children: day.count > 0 && (_jsx("div", { class: "ep:h-full ep:rounded", style: {
                                    width: `${(day.count / maxCount) * 100}%`,
                                    backgroundColor: day.isHeavy
                                        ? "var(--color-orange)"
                                        : "var(--color-blue)",
                                    opacity: day.isToday ? 1 : 0.7,
                                } })) }), _jsx("span", { class: `ep:w-6 ep:text-right ${day.count > 0 ? "" : "ep:text-obs-muted"}`, children: day.count }), showTime && (_jsxs("span", { class: "ep:w-10 ep:text-right ep:text-obs-muted", children: ["~", day.estimatedMinutes, "m"] })), showFlags && day.isToday && day.count > 0 && (_jsx("span", { class: "ep:text-obs-accent ep:font-semibold ep:w-16 ep:text-right", children: "Review \u2192" })), showFlags && !day.isToday && day.isHeavy && (_jsx("span", { class: "ep:w-16 ep:text-right", style: { color: "var(--color-orange)" }, children: "heavy" })), showFlags && !day.isToday && day.isLightest && !day.isHeavy && (_jsx("span", { class: "ep:w-16 ep:text-right ep:text-obs-muted", children: "lightest" })), showFlags && !day.isToday && !day.isHeavy && !day.isLightest && (_jsx("span", { class: "ep:w-16" }))] }, `${day.label}-${day.daysAhead}`))) }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs ep:text-obs-muted ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: [_jsxs("span", { children: ["Peak: ", data.peakDay.label, " (", data.peakDay.count, ")"] }), data.needsBalancing && (_jsxs(_Fragment, { children: [_jsx("span", { style: { opacity: 0.4 }, children: "\u2502" }), _jsx("span", { style: { color: "var(--color-orange)" }, children: "Balance: needs attention" })] }))] })] }));
}
