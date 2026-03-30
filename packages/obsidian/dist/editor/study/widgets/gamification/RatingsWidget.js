import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
const RATINGS = [
    { key: "again", label: "Again", color: "var(--color-red)" },
    { key: "hard", label: "Hard", color: "var(--color-orange)" },
    { key: "good", label: "Good", color: "var(--color-green)" },
    { key: "easy", label: "Easy", color: "var(--color-cyan)" },
];
const PERIOD_LABELS = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time",
};
function computeRatingsData(statsCalc, period) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (period === "today") {
        const allStats = statsCalc.getAllDailyStats();
        const todayKey = (_a = new Date().toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
        const todayStats = allStats[todayKey];
        if (!todayStats)
            return { again: 0, hard: 0, good: 0, easy: 0, total: 0 };
        const again = (_b = todayStats.again) !== null && _b !== void 0 ? _b : 0;
        const hard = (_c = todayStats.hard) !== null && _c !== void 0 ? _c : 0;
        const good = (_d = todayStats.good) !== null && _d !== void 0 ? _d : 0;
        const easy = (_e = todayStats.easy) !== null && _e !== void 0 ? _e : 0;
        return { again, hard, good, easy, total: again + hard + good + easy };
    }
    if (period === "week") {
        const allStats = statsCalc.getAllDailyStats();
        const today = new Date();
        let again = 0;
        let hard = 0;
        let good = 0;
        let easy = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = (_f = d.toISOString().split("T")[0]) !== null && _f !== void 0 ? _f : "";
            const entry = allStats[key];
            if (entry) {
                again += (_g = entry.again) !== null && _g !== void 0 ? _g : 0;
                hard += (_h = entry.hard) !== null && _h !== void 0 ? _h : 0;
                good += (_j = entry.good) !== null && _j !== void 0 ? _j : 0;
                easy += (_k = entry.easy) !== null && _k !== void 0 ? _k : 0;
            }
        }
        return { again, hard, good, easy, total: again + hard + good + easy };
    }
    // "month" -> "1m", "all" -> "all"
    const range = period === "month" ? "1m" : "all";
    const entries = statsCalc.getRatingDistributionHistory(range);
    let again = 0;
    let hard = 0;
    let good = 0;
    let easy = 0;
    for (const entry of entries) {
        again += entry.again;
        hard += entry.hard;
        good += entry.good;
        easy += entry.easy;
    }
    return { again, hard, good, easy, total: again + hard + good + easy };
}
function formatPct(count, total) {
    if (total === 0)
        return "0%";
    return `${Math.round((count / total) * 100)}%`;
}
// SVG donut chart constants
const DONUT_SIZE = 100;
const DONUT_RADIUS = 38;
const DONUT_STROKE = 12;
const DONUT_CENTER = DONUT_SIZE / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
function BarChart({ data }) {
    const maxCount = Math.max(1, data.again, data.hard, data.good, data.easy);
    return (_jsx("div", { class: "ep:flex ep:flex-col ep:gap-1.5", children: RATINGS.map((r) => {
            const count = data[r.key];
            const pct = (count / maxCount) * 100;
            return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs", children: [_jsx("span", { class: "ep:w-10 ep:text-obs-muted ep:shrink-0", children: r.label }), _jsx("div", { class: "ep:flex-1 ep:h-4 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden", children: _jsx("div", { class: "ep:h-full ep:rounded ep:transition-all", style: {
                                width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                                backgroundColor: r.color,
                            } }) }), _jsxs("span", { class: "ep:w-16 ep:text-right ep:tabular-nums ep:shrink-0", children: [count, " (", formatPct(count, data.total), ")"] })] }, r.key));
        }) }));
}
function DonutChart({ data }) {
    const segments = [];
    for (const r of RATINGS) {
        const count = data[r.key];
        const pct = data.total > 0 ? (count / data.total) * 100 : 0;
        segments.push({ color: r.color, pct, key: r.key, label: r.label, count });
    }
    let offset = 0;
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:gap-2", children: [_jsxs("svg", { viewBox: `0 0 ${DONUT_SIZE} ${DONUT_SIZE}`, class: "ep:w-24 ep:h-24", "aria-hidden": "true", children: [_jsx("circle", { cx: DONUT_CENTER, cy: DONUT_CENTER, r: DONUT_RADIUS, fill: "none", stroke: "var(--background-modifier-hover)", "stroke-width": DONUT_STROKE }), segments.map((seg) => {
                        if (seg.pct === 0)
                            return null;
                        const segmentLength = DONUT_CIRCUMFERENCE * (seg.pct / 100);
                        const dashOffset = -offset;
                        offset += segmentLength;
                        return (_jsx("circle", { cx: DONUT_CENTER, cy: DONUT_CENTER, r: DONUT_RADIUS, fill: "none", stroke: seg.color, "stroke-width": DONUT_STROKE, "stroke-dasharray": `${segmentLength} ${DONUT_CIRCUMFERENCE - segmentLength}`, "stroke-dashoffset": dashOffset, "stroke-linecap": "butt", transform: `rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})` }, seg.key));
                    }), _jsx("text", { x: DONUT_CENTER, y: DONUT_CENTER, "text-anchor": "middle", "dominant-baseline": "central", class: "ep:text-xs ep:font-semibold", fill: "var(--text-normal)", children: data.total })] }), _jsx("div", { class: "ep:flex ep:flex-wrap ep:justify-center ep:gap-x-3 ep:gap-y-1 ep:text-xs", children: segments.map((seg) => (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx("span", { class: "ep:w-2 ep:h-2 ep:rounded-full ep:shrink-0", style: { backgroundColor: seg.color } }), _jsxs("span", { class: "ep:text-obs-muted", children: [seg.label, " ", seg.count] })] }, seg.key))) })] }));
}
export function RatingsWidget({ source }) {
    var _a;
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const period = configValue(config, "period", "week");
        return computeRatingsData(statsCalc, String(period));
    }).value;
    if (!data) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    const period = String(configValue(config, "period", "week"));
    const style = String(configValue(config, "style", "bar"));
    const periodLabel = (_a = PERIOD_LABELS[period]) !== null && _a !== void 0 ? _a : "This Week";
    if (data.total === 0) {
        return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsx("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: _jsx("span", { class: "ep:text-obs-muted", children: periodLabel }) }), _jsx("div", { class: "ep:text-obs-muted ep:text-xs", children: "No reviews in this period" })] }));
    }
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsx("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: _jsx("span", { class: "ep:text-obs-muted", children: periodLabel }) }), style === "donut" ? (_jsx(DonutChart, { data: data })) : (_jsx(BarChart, { data: data }))] }));
}
