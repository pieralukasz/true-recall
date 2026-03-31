import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function formatDateLabel(dateStr) {
    var _a;
    const d = new Date(dateStr);
    return (_a = DAY_NAMES[d.getDay()]) !== null && _a !== void 0 ? _a : "";
}
export function ForecastWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const days = configValue(config, "days", 14);
    const showChart = configValue(config, "showChart", true);
    const data = useComputed(() => {
        void cards.value;
        if (!plugin.fsrsHelper)
            return null;
        const summary = plugin.fsrsHelper.getWorkloadForecastSummary(days);
        const entries = showChart
            ? plugin.fsrsHelper.getWorkloadForecast(days)
            : [];
        return { summary, entries };
    }).value;
    if (!plugin.fsrsHelper) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    if (!data || data.summary.avgDaily === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No upcoming reviews" }));
    }
    const { summary, entries } = data;
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsxs("span", { class: "ep:font-semibold", children: ["Forecast (", days, "d)"] }), _jsxs("span", { class: "ep:text-obs-muted", children: [Math.round(summary.avgDaily), " cards/day avg"] })] }), _jsxs("div", { class: "ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:text-xs", children: [_jsx(StatCell, { label: "Peak", value: `${formatDateLabel(summary.peakDay.date)} (${summary.peakDay.count})`, highlight: summary.peakDay.count > summary.avgDaily * 1.5 }), _jsx(StatCell, { label: "Lightest", value: `${formatDateLabel(summary.minDay.date)} (${summary.minDay.count})` }), _jsx(StatCell, { label: "Above avg", value: `${summary.daysAboveTarget} days` }), _jsx(StatCell, { label: "Balance", value: summary.needsBalancing ? "Needs attention" : "OK", color: summary.needsBalancing
                            ? "var(--color-orange)"
                            : "var(--color-green)" })] }), showChart && entries.length > 0 && (_jsx(MiniBarChart, { entries: entries, avgDaily: summary.avgDaily }))] }));
}
function StatCell({ label, value, color, highlight, }) {
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between", children: [_jsx("span", { class: "ep:text-obs-muted", children: label }), _jsx("span", { class: highlight ? "ep:font-medium" : "", style: color ? { color } : undefined, children: value })] }));
}
function MiniBarChart({ entries, avgDaily, }) {
    const maxCount = Math.max(1, ...entries.map((e) => e.dueCount));
    const chartHeight = 24;
    const barWidth = 3;
    const gap = 1;
    const totalWidth = entries.length * (barWidth + gap) - gap;
    const today = new Date().toISOString().split("T")[0];
    return (_jsx("div", { class: "ep:flex ep:flex-col ep:gap-1 ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: _jsx("svg", { width: "100%", height: chartHeight, viewBox: `0 0 ${totalWidth} ${chartHeight}`, preserveAspectRatio: "none", "aria-hidden": "true", children: entries.map((entry, i) => {
                const barH = maxCount > 0
                    ? Math.max(1, (entry.dueCount / maxCount) * chartHeight)
                    : 1;
                const isToday = entry.date === today;
                const isHeavy = entry.dueCount > avgDaily * 1.5;
                let fill;
                if (isToday)
                    fill = "var(--interactive-accent)";
                else if (isHeavy)
                    fill = "var(--color-orange)";
                else
                    fill = "var(--color-blue)";
                return (_jsx("rect", { x: i * (barWidth + gap), y: chartHeight - barH, width: barWidth, height: barH, rx: "1", fill: fill, opacity: isToday ? 1 : 0.7 }, entry.date));
            }) }) }));
}
