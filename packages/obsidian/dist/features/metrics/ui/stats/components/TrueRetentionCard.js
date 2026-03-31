import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";
export function TrueRetentionCard({ summary, history, }) {
    const canvasRef = useRef(null);
    const targetPct = Math.round(summary.target * 100);
    const currentPct = Math.round(summary.current * 100);
    const avgPct = Math.round(summary.average * 100);
    useChart(canvasRef, () => {
        if (history.length === 0)
            return null;
        const labels = history.map((e) => formatLabel(e.date));
        return {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "True Retention",
                        data: history.map((e) => Math.round(e.retention * 100)),
                        borderColor: CHART_COLORS.green(),
                        backgroundColor: withAlpha(CHART_COLORS.green(), 0.1),
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHitRadius: 8,
                        borderWidth: 2,
                    },
                    {
                        label: "Target",
                        data: history.map(() => targetPct),
                        borderColor: withAlpha(CHART_COLORS.muted(), 0.6),
                        borderDash: [6, 4],
                        borderWidth: 1.5,
                        pointRadius: 0,
                        pointHitRadius: 0,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => { var _a, _b, _c, _d; return (_d = (_c = history[(_b = (_a = items[0]) === null || _a === void 0 ? void 0 : _a.dataIndex) !== null && _b !== void 0 ? _b : 0]) === null || _c === void 0 ? void 0 : _c.date) !== null && _d !== void 0 ? _d : ""; },
                            label: (item) => `${item.dataset.label}: ${String(item.raw)}%`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: CHART_COLORS.muted(),
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                        },
                    },
                    y: {
                        min: Math.max(0, targetPct - 20),
                        max: 100,
                        grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
                        ticks: {
                            color: CHART_COLORS.muted(),
                            callback: (v) => `${String(v)}%`,
                        },
                    },
                },
            },
        };
    }, [history, targetPct]);
    if (summary.totalReviews === 0) {
        return (_jsx(ChartCard, { title: "True Retention", subtitle: "Mature card retention (interval >= 21d)", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "Not enough mature card reviews yet" }) }));
    }
    return (_jsxs(ChartCard, { title: "True Retention", subtitle: "Mature card retention (interval >= 21d)", children: [_jsxs("div", { class: "ep:flex ep:items-baseline ep:gap-3 ep:mb-3", children: [_jsxs("span", { class: "ep:text-3xl ep:font-bold ep:text-obs-normal", children: [currentPct, "%"] }), _jsxs("span", { class: "ep:text-xs ep:text-obs-muted", children: ["Target: ", targetPct, "%"] }), _jsx(TrendBadge, { trend: summary.trend })] }), _jsx("div", { class: "ep:h-40", children: _jsx("canvas", { ref: canvasRef }) }), _jsxs("div", { class: "ep:flex ep:gap-4 ep:mt-3 ep:text-xs ep:text-obs-muted", children: [_jsxs("span", { children: ["Avg: ", avgPct, "%"] }), _jsxs("span", { children: [summary.totalReviews.toLocaleString(), " mature reviews"] })] })] }));
}
function TrendBadge({ trend }) {
    if (trend === 1) {
        return (_jsx("span", { class: "ep:text-xs ep:font-medium ep:text-obs-green ep:bg-obs-green/10 ep:px-1.5 ep:py-0.5 ep:rounded", children: "Improving" }));
    }
    if (trend === -1) {
        return (_jsx("span", { class: "ep:text-xs ep:font-medium ep:text-obs-orange ep:bg-obs-orange/10 ep:px-1.5 ep:py-0.5 ep:rounded", children: "Declining" }));
    }
    return (_jsx("span", { class: "ep:text-xs ep:font-medium ep:text-obs-muted ep:bg-obs-modifier-hover ep:px-1.5 ep:py-0.5 ep:rounded", children: "Stable" }));
}
function formatLabel(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
