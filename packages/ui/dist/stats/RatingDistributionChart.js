import { jsx as _jsx } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "./chart-theme";
import { useChart } from "./use-chart";
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
                        data: data.map((d) => d.again),
                        backgroundColor: withAlpha(CHART_COLORS.red(), 0.8),
                    },
                    {
                        label: "Hard",
                        data: data.map((d) => d.hard),
                        backgroundColor: withAlpha(CHART_COLORS.orange(), 0.8),
                    },
                    {
                        label: "Good",
                        data: data.map((d) => d.good),
                        backgroundColor: withAlpha(CHART_COLORS.green(), 0.8),
                    },
                    {
                        label: "Easy",
                        data: data.map((d) => d.easy),
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
        return (_jsx(ChartCard, { title: "Rating Distribution", subtitle: "Answer rating breakdown", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No data yet" }) }));
    }
    return (_jsx(ChartCard, { title: "Rating Distribution", subtitle: "Answer rating breakdown", children: _jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }) }));
}
function formatLabel(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
