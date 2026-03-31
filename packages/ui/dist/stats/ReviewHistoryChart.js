import { jsx as _jsx } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "./chart-theme";
import { useChart } from "./use-chart";
import { ChartCard } from "./ChartCard";
export function ReviewHistoryChart({ data }) {
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
                        label: "New",
                        data: data.map((d) => { var _a; return (_a = d.newCards) !== null && _a !== void 0 ? _a : 0; }),
                        backgroundColor: withAlpha(CHART_COLORS.green(), 0.8),
                    },
                    {
                        label: "Learning",
                        data: data.map((d) => { var _a; return (_a = d.learningCards) !== null && _a !== void 0 ? _a : 0; }),
                        backgroundColor: withAlpha(CHART_COLORS.orange(), 0.8),
                    },
                    {
                        label: "Review",
                        data: data.map((d) => { var _a; return (_a = d.reviewCards) !== null && _a !== void 0 ? _a : 0; }),
                        backgroundColor: withAlpha(CHART_COLORS.blue(), 0.8),
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
                        beginAtZero: true,
                        grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
                        ticks: { color: CHART_COLORS.muted() },
                    },
                },
            },
        };
    }, [data]);
    if (data.length === 0) {
        return (_jsx(ChartCard, { title: "Review History", subtitle: "Daily review breakdown", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No review data yet" }) }));
    }
    return (_jsx(ChartCard, { title: "Review History", subtitle: "Daily review breakdown", children: _jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }) }));
}
function formatLabel(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
