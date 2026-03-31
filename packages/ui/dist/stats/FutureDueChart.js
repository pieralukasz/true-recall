import { jsx as _jsx } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "./chart-theme";
import { useChart } from "./use-chart";
import { ChartCard } from "./ChartCard";
export function FutureDueChart({ data }) {
    const canvasRef = useRef(null);
    useChart(canvasRef, () => {
        if (data.length === 0)
            return null;
        return {
            type: "bar",
            data: {
                labels: data.map((d) => {
                    const dt = new Date(d.date);
                    return `${dt.getMonth() + 1}/${dt.getDate()}`;
                }),
                datasets: [
                    {
                        label: "Due",
                        data: data.map((d) => d.count),
                        backgroundColor: withAlpha(CHART_COLORS.blue(), 0.7),
                        borderRadius: 3,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: CHART_COLORS.muted(),
                            maxRotation: 0,
                            autoSkip: true,
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
    }, [data]);
    if (data.length === 0) {
        return (_jsx(ChartCard, { title: "Future Due", subtitle: "Cards due in coming days", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No forecast data" }) }));
    }
    return (_jsx(ChartCard, { title: "Future Due", subtitle: "Cards due in coming days", children: _jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }) }));
}
