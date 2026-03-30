import { jsx as _jsx } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";
export function CreatedVsReviewedChart({ created, reviewHistory, }) {
    const canvasRef = useRef(null);
    const reviewMap = new Map(reviewHistory.map((d) => [d.date, d.reviewsCompleted]));
    useChart(canvasRef, () => {
        if (created.length === 0)
            return null;
        const labels = created.map((d) => formatLabel(d.date));
        return {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Created",
                        data: created.map((d) => d.count),
                        borderColor: CHART_COLORS.green(),
                        backgroundColor: withAlpha(CHART_COLORS.green(), 0.1),
                        fill: true,
                        tension: 0.3,
                        pointRadius: created.length > 30 ? 0 : 3,
                    },
                    {
                        label: "Reviewed",
                        data: created.map((d) => { var _a; return (_a = reviewMap.get(d.date)) !== null && _a !== void 0 ? _a : 0; }),
                        borderColor: CHART_COLORS.blue(),
                        backgroundColor: withAlpha(CHART_COLORS.blue(), 0.1),
                        fill: true,
                        tension: 0.3,
                        pointRadius: created.length > 30 ? 0 : 3,
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
    if (created.length === 0) {
        return (_jsx(ChartCard, { title: "Created vs Reviewed", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No data yet" }) }));
    }
    return (_jsx(ChartCard, { title: "Created vs Reviewed", subtitle: "Card creation compared to review activity", children: _jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }) }));
}
function formatLabel(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
