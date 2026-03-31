import { jsx as _jsx } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS } from "./chart-theme";
import { useChart } from "./use-chart";
import { ChartCard } from "./ChartCard";
export function CardMaturitySection({ data }) {
    const canvasRef = useRef(null);
    useChart(canvasRef, () => {
        const total = data.mature + data.young + data.new + data.suspended;
        if (total === 0)
            return null;
        return {
            type: "doughnut",
            data: {
                labels: ["Mature", "Young", "New", "Suspended"],
                datasets: [
                    {
                        data: [data.mature, data.young, data.new, data.suspended],
                        backgroundColor: [
                            CHART_COLORS.green(),
                            CHART_COLORS.blue(),
                            CHART_COLORS.orange(),
                            CHART_COLORS.red(),
                        ],
                        borderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "right",
                        labels: {
                            color: CHART_COLORS.normal(),
                            padding: 8,
                            font: { size: 11 },
                        },
                    },
                },
            },
        };
    }, [data]);
    const total = data.mature + data.young + data.new + data.suspended;
    if (total === 0) {
        return (_jsx(ChartCard, { title: "Card Maturity", subtitle: "Distribution by maturity", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No cards yet" }) }));
    }
    return (_jsx(ChartCard, { title: "Card Maturity", subtitle: "Distribution by maturity", children: _jsx("div", { class: "ep:h-48", children: _jsx("canvas", { ref: canvasRef }) }) }));
}
