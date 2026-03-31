import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useRef } from "preact/hooks";
import { CHART_COLORS } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";
export function CardMaturitySection({ data }) {
    const canvasRef = useRef(null);
    const total = data.new +
        data.learning +
        data.young +
        data.mature +
        data.suspended +
        data.buried;
    const maturePercent = total > 0 ? Math.round((data.mature / total) * 100) : 0;
    useChart(canvasRef, () => {
        if (total === 0)
            return null;
        return {
            type: "doughnut",
            data: {
                labels: ["New", "Learning", "Young", "Mature", "Suspended", "Buried"],
                datasets: [
                    {
                        data: [
                            data.new,
                            data.learning,
                            data.young,
                            data.mature,
                            data.suspended,
                            data.buried,
                        ],
                        backgroundColor: [
                            CHART_COLORS.green(),
                            CHART_COLORS.orange(),
                            CHART_COLORS.blue(),
                            CHART_COLORS.cyan(),
                            CHART_COLORS.red(),
                            CHART_COLORS.muted(),
                        ],
                        borderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "60%",
                plugins: {
                    legend: {
                        position: "right",
                        labels: {
                            color: CHART_COLORS.normal(),
                            boxWidth: 10,
                            padding: 6,
                            font: { size: 11 },
                        },
                    },
                },
            },
        };
    }, [data]);
    if (total === 0) {
        return (_jsx(ChartCard, { title: "Card Maturity", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No cards yet" }) }));
    }
    return (_jsx(ChartCard, { title: "Card Maturity", subtitle: `${maturePercent}% mature — ${total} total cards`, children: _jsxs("div", { class: "ep:flex ep:items-center ep:gap-4", children: [_jsx("div", { class: "ep:h-40 ep:w-40 ep:shrink-0", children: _jsx("canvas", { ref: canvasRef }) }), _jsxs("div", { class: "ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:text-xs", children: [_jsx(MaturityRow, { label: "New", count: data.new, color: "ep:text-obs-green" }), _jsx(MaturityRow, { label: "Learning", count: data.learning, color: "ep:text-obs-orange" }), _jsx(MaturityRow, { label: "Young", count: data.young, color: "ep:text-obs-blue" }), _jsx(MaturityRow, { label: "Mature", count: data.mature, color: "ep:text-obs-cyan" }), _jsx(MaturityRow, { label: "Suspended", count: data.suspended, color: "ep:text-obs-error" }), _jsx(MaturityRow, { label: "Buried", count: data.buried, color: "ep:text-obs-muted" })] })] }) }));
}
function MaturityRow({ label, count, color, }) {
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:gap-2", children: [_jsx("span", { class: `${color} ep:font-medium`, children: label }), _jsx("span", { class: "ep:text-obs-muted", children: count })] }));
}
