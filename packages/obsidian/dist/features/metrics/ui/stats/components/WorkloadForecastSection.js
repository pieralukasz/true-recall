import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";
export function WorkloadForecastSection({ forecast, summary, dayOfWeek, }) {
    const canvasRef = useRef(null);
    const dowCanvasRef = useRef(null);
    useChart(canvasRef, () => {
        if (forecast.length === 0)
            return null;
        const labels = forecast.map((d) => formatLabel(d.date));
        return {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Review",
                        data: forecast.map((d) => d.breakdown.review),
                        backgroundColor: withAlpha(CHART_COLORS.blue(), 0.7),
                        borderRadius: 2,
                    },
                    {
                        label: "Learning",
                        data: forecast.map((d) => d.breakdown.learning),
                        backgroundColor: withAlpha(CHART_COLORS.orange(), 0.7),
                        borderRadius: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: "top",
                        labels: {
                            color: CHART_COLORS.muted(),
                            boxWidth: 10,
                            padding: 12,
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            title: (items) => { var _a, _b, _c, _d; return (_d = (_c = forecast[(_b = (_a = items[0]) === null || _a === void 0 ? void 0 : _a.dataIndex) !== null && _b !== void 0 ? _b : 0]) === null || _c === void 0 ? void 0 : _c.date) !== null && _d !== void 0 ? _d : ""; },
                            footer: (items) => {
                                var _a, _b;
                                const idx = (_b = (_a = items[0]) === null || _a === void 0 ? void 0 : _a.dataIndex) !== null && _b !== void 0 ? _b : 0;
                                const entry = forecast[idx];
                                return entry ? `Total: ${String(entry.dueCount)}` : "";
                            },
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
    }, [forecast]);
    useChart(dowCanvasRef, () => {
        if (dayOfWeek.length === 0)
            return null;
        const sunday = dayOfWeek[0];
        if (!sunday)
            return null;
        const reordered = [...dayOfWeek.slice(1), sunday];
        return {
            type: "bar",
            data: {
                labels: reordered.map((d) => d.dayName.slice(0, 3)),
                datasets: [
                    {
                        label: "Avg",
                        data: reordered.map((d) => d.avgCount),
                        backgroundColor: withAlpha(CHART_COLORS.purple(), 0.6),
                        borderRadius: 3,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: CHART_COLORS.muted(), font: { size: 10 } },
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: withAlpha(CHART_COLORS.border(), 0.3) },
                        ticks: { color: CHART_COLORS.muted(), font: { size: 10 } },
                    },
                },
            },
        };
    }, [dayOfWeek]);
    if (forecast.length === 0) {
        return (_jsx(ChartCard, { title: "Workload Forecast", subtitle: "Predicted daily reviews (next 30 days)", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No cards scheduled" }) }));
    }
    return (_jsxs(ChartCard, { title: "Workload Forecast", subtitle: "Predicted daily reviews (next 30 days)", children: [_jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }), _jsxs("div", { class: "ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:mt-3 ep:text-xs ep:text-obs-muted", children: [_jsxs("span", { children: ["Avg: ", summary.avgDaily, "/day"] }), _jsxs("span", { children: ["Peak: ", summary.peakDay.count, " (", formatShortDate(summary.peakDay.date), ")"] }), _jsxs("span", { children: ["Min: ", summary.minDay.count, " (", formatShortDate(summary.minDay.date), ")"] }), summary.daysAboveTarget > 0 && (_jsxs("span", { children: [summary.daysAboveTarget, " days above target"] }))] }), summary.needsBalancing && (_jsx("div", { class: "ep:mt-2 ep:text-xs ep:text-obs-orange ep:bg-obs-orange/10 ep:px-2.5 ep:py-1.5 ep:rounded", children: "Workload is uneven \u2014 consider using Load Balance to smooth reviews" })), dayOfWeek.length > 0 && (_jsxs("div", { class: "ep:mt-4", children: [_jsx("p", { class: "ep:text-xs ep:font-medium ep:text-obs-muted ep:mb-2", children: "Average by day of week" }), _jsx("div", { class: "ep:h-24", children: _jsx("canvas", { ref: dowCanvasRef }) })] }))] }));
}
function formatLabel(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
function formatShortDate(date) {
    if (!date)
        return "—";
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
