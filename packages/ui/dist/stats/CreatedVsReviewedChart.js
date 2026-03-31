import { jsx as _jsx } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "./chart-theme";
import { useChart } from "./use-chart";
import { ChartCard } from "./ChartCard";
export function CreatedVsReviewedChart({ created, reviewHistory, }) {
    const canvasRef = useRef(null);
    useChart(canvasRef, () => {
        // Merge dates
        const dateSet = new Set();
        for (const c of created)
            dateSet.add(c.date);
        for (const r of reviewHistory)
            dateSet.add(r.date);
        const dates = Array.from(dateSet).sort();
        if (dates.length === 0)
            return null;
        const createdMap = new Map(created.map((c) => [c.date, c.count]));
        const reviewedMap = new Map(reviewHistory.map((r) => [r.date, r.reviewsCompleted]));
        return {
            type: "bar",
            data: {
                labels: dates.map((d) => {
                    const dt = new Date(d);
                    return `${dt.getMonth() + 1}/${dt.getDate()}`;
                }),
                datasets: [
                    {
                        label: "Created",
                        data: dates.map((d) => { var _a; return (_a = createdMap.get(d)) !== null && _a !== void 0 ? _a : 0; }),
                        backgroundColor: withAlpha(CHART_COLORS.green(), 0.7),
                    },
                    {
                        label: "Reviewed",
                        data: dates.map((d) => { var _a; return (_a = reviewedMap.get(d)) !== null && _a !== void 0 ? _a : 0; }),
                        backgroundColor: withAlpha(CHART_COLORS.blue(), 0.7),
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: CHART_COLORS.normal(),
                            boxWidth: 12,
                            padding: 8,
                            font: { size: 11 },
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
                            maxTicksLimit: 10,
                        },
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
                        ticks: { color: CHART_COLORS.muted() },
                    },
                },
            },
        };
    }, [created, reviewHistory]);
    if (created.length === 0 && reviewHistory.length === 0) {
        return (_jsx(ChartCard, { title: "Created vs Reviewed", subtitle: "New cards vs reviews over time", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No data yet" }) }));
    }
    return (_jsx(ChartCard, { title: "Created vs Reviewed", subtitle: "New cards vs reviews over time", children: _jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }) }));
}
