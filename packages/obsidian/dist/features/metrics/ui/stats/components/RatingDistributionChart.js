import { jsx as _jsx } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";
export function RatingDistributionChart({ data, }) {
    const canvasRef = useRef(null);
    useChart(canvasRef, () => {
        if (data.length === 0)
            return null;
        const labels = data.map((d) => formatLabel(d.date));
        return {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Again",
                        data: data.map((d) => d.total > 0 ? (d.again / d.total) * 100 : 0),
                        backgroundColor: withAlpha(CHART_COLORS.red(), 0.8),
                    },
                    {
                        label: "Hard",
                        data: data.map((d) => (d.total > 0 ? (d.hard / d.total) * 100 : 0)),
                        backgroundColor: withAlpha(CHART_COLORS.orange(), 0.8),
                    },
                    {
                        label: "Good",
                        data: data.map((d) => (d.total > 0 ? (d.good / d.total) * 100 : 0)),
                        backgroundColor: withAlpha(CHART_COLORS.green(), 0.8),
                    },
                    {
                        label: "Easy",
                        data: data.map((d) => (d.total > 0 ? (d.easy / d.total) * 100 : 0)),
                        backgroundColor: withAlpha(CHART_COLORS.cyan(), 0.8),
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            color: CHART_COLORS.normal(),
                            boxWidth: 12,
                            padding: 8,
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => { var _a; return `${ctx.dataset.label}: ${Math.round((_a = ctx.parsed.y) !== null && _a !== void 0 ? _a : 0)}%`; },
                            title: (items) => { var _a, _b, _c, _d; return (_d = (_c = data[(_b = (_a = items[0]) === null || _a === void 0 ? void 0 : _a.dataIndex) !== null && _b !== void 0 ? _b : 0]) === null || _c === void 0 ? void 0 : _c.date) !== null && _d !== void 0 ? _d : ""; },
                        },
                    },
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: {
                            color: CHART_COLORS.muted(),
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                        },
                    },
                    y: {
                        stacked: true,
                        min: 0,
                        max: 100,
                        grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
                        ticks: {
                            color: CHART_COLORS.muted(),
                            callback: (v) => `${v}%`,
                        },
                    },
                },
            },
        };
    }, [data]);
    if (data.length === 0) {
        return (_jsx(ChartCard, { title: "Answer Buttons", subtitle: "Rating distribution", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No rating data yet" }) }));
    }
    return (_jsx(ChartCard, { title: "Answer Buttons", subtitle: "Rating distribution over time", children: _jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }) }));
}
function formatLabel(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
