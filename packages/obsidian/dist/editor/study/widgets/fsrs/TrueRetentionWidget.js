import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
const TREND_ARROWS = {
    1: { symbol: "\u2191", color: "var(--color-green)" },
    0: { symbol: "\u2192", color: "var(--text-muted)" },
    [-1]: { symbol: "\u2193", color: "var(--color-red)" },
};
export function TrueRetentionWidget({ source }) {
    var _a, _b;
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const days = configValue(config, "days", 30);
    const showSparkline = configValue(config, "showSparkline", true);
    const showTarget = configValue(config, "showTarget", true);
    const data = useComputed(() => {
        void cards.value;
        if (!plugin.fsrsHelper)
            return null;
        const summary = plugin.fsrsHelper.getTrueRetentionSummary(days);
        const history = showSparkline
            ? plugin.fsrsHelper.getTrueRetentionHistory(days)
            : [];
        return { summary, history };
    }).value;
    if (!plugin.fsrsHelper) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    if (!data || data.summary.totalReviews === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Review more cards to see true retention" }));
    }
    const { summary, history } = data;
    const currentPct = Math.round(summary.current * 100);
    const targetPct = Math.round(summary.target * 100);
    const diff = currentPct - targetPct;
    const retentionColor = diff >= 0
        ? "var(--color-green)"
        : diff >= -5
            ? "var(--color-orange)"
            : "var(--color-red)";
    const trend = (_b = (_a = TREND_ARROWS[summary.trend]) !== null && _a !== void 0 ? _a : TREND_ARROWS[0]) !== null && _b !== void 0 ? _b : { symbol: "", color: "var(--text-muted)" };
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsx("span", { class: "ep:font-semibold", children: "True Retention" }), showTarget && (_jsxs("span", { class: "ep:text-obs-muted", children: ["target: ", targetPct, "%"] }))] }), _jsxs("div", { class: "ep:flex ep:items-baseline ep:gap-2", children: [_jsxs("span", { class: "ep:text-2xl ep:font-bold ep:leading-none", style: { color: retentionColor }, children: [currentPct, "%"] }), _jsx("span", { class: "ep:text-sm ep:font-semibold", style: { color: trend.color }, children: trend.symbol }), _jsxs("span", { class: "ep:text-xs ep:text-obs-muted ep:ml-auto", children: ["avg ", Math.round(summary.average * 100), "%"] })] }), showSparkline && history.length > 1 && (_jsx(Sparkline, { data: history.map((h) => h.retention), target: summary.target, color: retentionColor })), _jsxs("div", { class: "ep:text-xs ep:text-obs-muted", children: [summary.totalReviews, " mature reviews in last ", days, " days"] })] }));
}
function Sparkline({ data, target, color, }) {
    const width = 200;
    const height = 30;
    const padding = 2;
    const min = Math.min(...data, target) - 0.02;
    const max = Math.max(...data, target) + 0.02;
    const range = max - min || 0.01;
    const points = data
        .map((val, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return `${x},${y}`;
    })
        .join(" ");
    const targetY = height - padding - ((target - min) / range) * (height - padding * 2);
    return (_jsxs("svg", { width: "100%", height: height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", class: "ep:rounded", "aria-hidden": "true", children: [_jsx("line", { x1: 0, y1: targetY, x2: width, y2: targetY, stroke: "var(--text-muted)", "stroke-width": "0.5", "stroke-dasharray": "4,3", opacity: "0.5" }), _jsx("polyline", { points: points, fill: "none", stroke: color, "stroke-width": "1.5", "stroke-linejoin": "round", "stroke-linecap": "round" })] }));
}
