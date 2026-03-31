import { jsx as _jsx } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";
export function RetentionChart({ data, targetRetention = 90, }) {
    const canvasRef = useRef(null);
    useChart(canvasRef, () => {
        if (data.length === 0)
            return null;
        const labels = data.map((d) => formatLabel(d.date));
        return {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Retention",
                        data: data.map((d) => d.retention),
                        borderColor: CHART_COLORS.green(),
                        backgroundColor: withAlpha(CHART_COLORS.green(), 0.1),
                        fill: true,
                        tension: 0.3,
                        pointRadius: data.length > 30 ? 0 : 3,
                        pointHoverRadius: 5,
                    },
                    {
                        label: "Target",
                        data: data.map(() => targetRetention),
                        borderColor: withAlpha(CHART_COLORS.muted(), 0.5),
                        borderDash: [5, 5],
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        fill: false,
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
    }, [data, targetRetention]);
    if (data.length === 0) {
        return (_jsx(ChartCard, { title: "Retention", subtitle: "Daily correct answer rate", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No retention data yet" }) }));
    }
    const avg = Math.round(data.reduce((s, d) => s + d.retention, 0) / data.length);
    return (_jsx(ChartCard, { title: "Retention", subtitle: `Average: ${avg}% — Target: ${targetRetention}%`, children: _jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }) }));
}
function formatLabel(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
