import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
export function ComparisonWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const period = configValue(config, "period", "week");
        const allStats = statsCalc.getAllDailyStats();
        const today = new Date();
        let currentStart;
        let previousStart;
        let previousEnd;
        let periodLabel;
        if (period === "month") {
            currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
            previousEnd = new Date(currentStart);
            previousEnd.setDate(previousEnd.getDate() - 1);
            previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), 1);
            periodLabel = "This Month vs Last Month";
        }
        else {
            // week (default)
            const dayOfWeek = today.getDay();
            const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            currentStart = new Date(today);
            currentStart.setDate(today.getDate() - mondayOffset);
            previousEnd = new Date(currentStart);
            previousEnd.setDate(previousEnd.getDate() - 1);
            previousStart = new Date(previousEnd);
            previousStart.setDate(previousEnd.getDate() - 6);
            periodLabel = "This Week vs Last Week";
        }
        const current = aggregatePeriod(allStats, currentStart, today);
        const previous = aggregatePeriod(allStats, previousStart, previousEnd);
        const streak = statsCalc.getStreakInfo();
        return { current, previous, streak, periodLabel };
    }).value;
    if (!data) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    const showStreak = configValue(config, "showStreak", true);
    const handleClick = () => {
        plugin.openCustomStudyModal().catch(() => { });
    };
    const rows = [
        Object.assign({ label: "Reviewed", current: String(data.current.reviewed), previous: String(data.previous.reviewed) }, formatDelta(data.current.reviewed, data.previous.reviewed, "pct")),
        Object.assign({ label: "Correct rate", current: `${Math.round(data.current.correctRate * 100)}%`, previous: `${Math.round(data.previous.correctRate * 100)}%` }, formatDelta(data.current.correctRate * 100, data.previous.correctRate * 100, "pp")),
        Object.assign({ label: "Time spent", current: `${data.current.timeMinutes}m`, previous: `${data.previous.timeMinutes}m` }, formatDelta(data.current.timeMinutes, data.previous.timeMinutes, "pct")),
        Object.assign({ label: "New cards", current: String(data.current.newCards), previous: String(data.previous.newCards) }, formatDelta(data.current.newCards, data.previous.newCards, "pct")),
    ];
    return (_jsxs(Clickable, { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", onClick: handleClick, title: "Start a study session", children: [_jsx("div", { class: "ep:text-xs ep:font-semibold", children: data.periodLabel }), _jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:text-xs ep:text-obs-muted ep:gap-2", children: [_jsx("span", { class: "ep:flex-1" }), _jsx("span", { class: "ep:w-16 ep:text-right", children: "Current" }), _jsx("span", { class: "ep:w-16 ep:text-right", children: "Previous" }), _jsx("span", { class: "ep:w-16 ep:text-right", children: "Change" })] }), rows.map((row) => (_jsxs("div", { class: "ep:flex ep:items-center ep:text-xs ep:gap-2", children: [_jsx("span", { class: "ep:flex-1", children: row.label }), _jsx("span", { class: "ep:w-16 ep:text-right ep:font-semibold", children: row.current }), _jsx("span", { class: "ep:w-16 ep:text-right ep:text-obs-muted", children: row.previous }), _jsx("span", { class: "ep:w-16 ep:text-right", style: {
                                    color: row.improved ? "var(--color-green)" : "var(--color-red)",
                                }, children: row.change })] }, row.label)))] }), showStreak && data.streak.current > 0 && (_jsxs("div", { class: "ep:text-xs ep:text-obs-muted ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: ["Streak: ", data.streak.current, "d", data.streak.longest > data.streak.current &&
                        ` (longest: ${data.streak.longest}d)`] }))] }));
}
function aggregatePeriod(allStats, start, end) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    let reviewed = 0;
    let totalCorrect = 0;
    let totalRatings = 0;
    let timeMs = 0;
    let newCards = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        const key = (_a = cursor.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
        const stats = allStats[key];
        if (stats) {
            reviewed += stats.reviewsCompleted;
            const dayRatings = ((_b = stats.again) !== null && _b !== void 0 ? _b : 0) +
                ((_c = stats.hard) !== null && _c !== void 0 ? _c : 0) +
                ((_d = stats.good) !== null && _d !== void 0 ? _d : 0) +
                ((_e = stats.easy) !== null && _e !== void 0 ? _e : 0);
            totalCorrect += ((_f = stats.good) !== null && _f !== void 0 ? _f : 0) + ((_g = stats.easy) !== null && _g !== void 0 ? _g : 0);
            totalRatings += dayRatings;
            timeMs += stats.totalTimeMs;
            newCards += (_h = stats.newCards) !== null && _h !== void 0 ? _h : 0;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return {
        reviewed,
        correctRate: totalRatings > 0 ? totalCorrect / totalRatings : 0,
        timeMinutes: Math.round(timeMs / 60000),
        newCards,
        avgDifficulty: 0, // Would need card-level data; omitted for simplicity
    };
}
function formatDelta(current, previous, mode) {
    if (previous === 0 && current === 0)
        return { change: "—", improved: true };
    if (previous === 0)
        return { change: "+∞", improved: true };
    if (mode === "pp") {
        const diff = current - previous;
        const sign = diff >= 0 ? "+" : "";
        return {
            change: `${sign}${Math.round(diff)}pp ${diff >= 0 ? "↑" : "↓"}`,
            improved: diff >= 0,
        };
    }
    const pct = ((current - previous) / previous) * 100;
    const sign = pct >= 0 ? "+" : "";
    return {
        change: `${sign}${Math.round(pct)}% ${pct >= 0 ? "↑" : "↓"}`,
        improved: pct >= 0,
    };
}
