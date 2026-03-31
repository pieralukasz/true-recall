import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { WorkloadForecastCalculator } from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { cards, cardsBySourceUid, globalCounts, } from "@true-recall/obsidian/services/reactive-card-store";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { State } from "ts-fsrs";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function formatDayLabel(date) {
    var _a;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dateStr = date.toISOString().split("T")[0];
    if (dateStr === todayStr)
        return "Today";
    return (_a = DAY_NAMES[date.getDay()]) !== null && _a !== void 0 ? _a : "";
}
export function DashboardWidget() {
    const plugin = usePlugin();
    // Subscribe to reactive data changes
    const _cards = cards.value;
    const counts = globalCounts.value;
    // Cache service instances — avoid re-creating on every render
    const { statsCalc, forecast } = useMemo(() => {
        const calc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        calc.setDayStartHour(plugin.settings.dayStartHour);
        return {
            statsCalc: calc,
            forecast: new WorkloadForecastCalculator(plugin.cardStore),
        };
    }, [plugin]);
    const data = useMemo(() => {
        if (!plugin.sessionPersistence || !plugin.cardStore)
            return null;
        const entries = forecast.getForecast(7);
        const todaySummary = statsCalc.getTodaySummary();
        const streakInfo = statsCalc.getStreakInfo();
        const forecastDays = entries.map((e) => ({
            label: formatDayLabel(new Date(e.date)),
            count: e.dueCount,
            isToday: e.date === new Date().toISOString().split("T")[0],
        }));
        const today = {
            studied: todaySummary.studied,
            minutes: todaySummary.minutes,
            correctRate: todaySummary.correctRate,
            streak: streakInfo.current,
        };
        const global = {
            total: counts.total,
            due: counts.due,
            newCount: counts.newCount,
            learning: counts.learning,
        };
        return { today, forecastDays, global };
    }, [_cards, counts, plugin, statsCalc, forecast]);
    if (!data) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    const maxCount = Math.max(1, ...data.forecastDays.map((d) => d.count));
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-3 ep:flex-wrap ep:text-xs", children: [data.today.studied > 0 && _jsxs("span", { children: [data.today.studied, " studied"] }), data.today.minutes > 0 && _jsxs("span", { children: [data.today.minutes, "m"] }), data.today.correctRate > 0 && (_jsxs("span", { children: [Math.round(data.today.correctRate * 100), "%"] })), data.today.streak > 0 && _jsxs("span", { children: [data.today.streak, "d streak"] }), data.today.studied === 0 && data.today.streak === 0 && (_jsx("span", { class: "ep:text-obs-muted", children: "No reviews today" }))] }), data.forecastDays.length > 0 && (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1", children: [_jsx("div", { class: "ep:text-xs ep:text-obs-muted ep:mb-0.5", children: "This week" }), data.forecastDays.map((day) => (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs", children: [_jsx("span", { class: `ep:w-10 ep:text-right ${day.isToday ? "ep:font-semibold" : "ep:text-obs-muted"}`, children: day.label }), _jsx("div", { class: "ep:flex-1 ep:h-3 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden", children: day.count > 0 && (_jsx("div", { class: "ep:h-full ep:rounded", style: {
                                        width: `${(day.count / maxCount) * 100}%`,
                                        backgroundColor: `var(${FSRS_COLORS.review.cssVar})`,
                                        opacity: day.isToday ? 1 : 0.7,
                                    } })) }), _jsx("span", { class: `ep:w-6 ep:text-right ${day.count > 0 ? "" : "ep:text-obs-muted"}`, children: day.count })] }, day.label)))] })), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs ep:flex-wrap ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: [_jsxs("span", { children: [data.global.total, " total"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.review.cssVar})` }, children: [data.global.due, " due"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.new.cssVar})` }, children: [data.global.newCount, " new"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.learning.cssVar})` }, children: [data.global.learning, " learning"] })] })] }));
}
export function NoteStatsWidget({ sourceUid }) {
    // Subscribe to reactive data changes
    const _cards = cards.value;
    const bySourceUid = cardsBySourceUid.value;
    const data = useMemo(() => {
        var _a, _b;
        if (!sourceUid)
            return null;
        const noteCards = (_a = bySourceUid.get(sourceUid)) !== null && _a !== void 0 ? _a : [];
        if (noteCards.length === 0)
            return null;
        const now = new Date();
        let newCount = 0;
        let learning = 0;
        let due = 0;
        let suspended = 0;
        for (const card of noteCards) {
            const fsrs = card.fsrs;
            if (fsrs.suspended) {
                suspended++;
                continue;
            }
            if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
                continue;
            switch (fsrs.state) {
                case State.New:
                    newCount++;
                    break;
                case State.Learning:
                case State.Relearning:
                    learning++;
                    break;
                case State.Review:
                    if (new Date(fsrs.due) <= now)
                        due++;
                    break;
            }
        }
        let lastReviewed = null;
        for (const card of noteCards) {
            const fsrs = card.fsrs;
            if (fsrs.lastReview) {
                if (!lastReviewed || fsrs.lastReview > lastReviewed) {
                    lastReviewed = fsrs.lastReview;
                }
            }
        }
        const forecastDays = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dateStr = (_b = date.toISOString().split("T")[0]) !== null && _b !== void 0 ? _b : "";
            let count = 0;
            for (const card of noteCards) {
                if (card.fsrs.suspended)
                    continue;
                const cardDate = new Date(card.fsrs.due).toISOString().split("T")[0];
                if (cardDate === dateStr)
                    count++;
            }
            forecastDays.push({
                label: formatDayLabel(date),
                count,
                isToday: i === 0,
            });
        }
        return {
            total: noteCards.length,
            newCount,
            learning,
            due,
            suspended,
            lastReviewed: lastReviewed
                ? new Date(lastReviewed).toLocaleDateString()
                : null,
            forecastDays,
        };
    }, [_cards, bySourceUid, sourceUid]);
    if (!data) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No flashcards found in this note." }));
    }
    const maxCount = Math.max(1, ...data.forecastDays.map((d) => d.count));
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs ep:flex-wrap", children: [_jsxs("span", { children: [data.total, " cards"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.review.cssVar})` }, children: [data.due, " due"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.new.cssVar})` }, children: [data.newCount, " new"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.learning.cssVar})` }, children: [data.learning, " learning"] }), data.suspended > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.suspended.cssVar})` }, children: [data.suspended, " suspended"] })] }))] }), data.lastReviewed && (_jsxs("div", { class: "ep:text-xs ep:text-obs-muted", children: ["Last reviewed: ", data.lastReviewed] })), data.forecastDays.some((d) => d.count > 0) && (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1", children: [_jsx("div", { class: "ep:text-xs ep:text-obs-muted ep:mb-0.5", children: "Due this week" }), data.forecastDays.map((day) => (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs", children: [_jsx("span", { class: `ep:w-10 ep:text-right ${day.isToday ? "ep:font-semibold" : "ep:text-obs-muted"}`, children: day.label }), _jsx("div", { class: "ep:flex-1 ep:h-3 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden", children: day.count > 0 && (_jsx("div", { class: "ep:h-full ep:rounded", style: {
                                        width: `${(day.count / maxCount) * 100}%`,
                                        backgroundColor: `var(${FSRS_COLORS.review.cssVar})`,
                                        opacity: day.isToday ? 1 : 0.7,
                                    } })) }), _jsx("span", { class: `ep:w-6 ep:text-right ${day.count > 0 ? "" : "ep:text-obs-muted"}`, children: day.count })] }, day.label)))] }))] }));
}
