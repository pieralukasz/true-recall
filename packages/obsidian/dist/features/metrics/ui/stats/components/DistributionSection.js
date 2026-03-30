import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSignal } from "@preact/signals";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { cn } from "@true-recall/obsidian/utils";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";
const TABS = [
    { value: "interval", label: "Intervals" },
    { value: "stability", label: "Stability" },
    { value: "difficulty", label: "Difficulty" },
];
export function DistributionSection({ data }) {
    const activeTab = useSignal("interval");
    if (!data) {
        return (_jsx(ChartCard, { title: "FSRS Distributions", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No data available" }) }));
    }
    const current = data[activeTab.value];
    return (_jsxs(ChartCard, { title: "FSRS Distributions", children: [_jsx("div", { class: "ep:flex ep:gap-1 ep:mb-3", children: TABS.map((tab) => (_jsx(Clickable, { role: "tab", "aria-selected": activeTab.value === tab.value, class: cn("ep:px-2.5 ep:py-1 ep:text-xs ep:font-medium ep:rounded-md ep:transition-colors", activeTab.value === tab.value
                        ? "ep:bg-obs-interactive/15 ep:text-obs-interactive"
                        : "ep:text-obs-muted ep:hover:text-obs-normal"), onClick: () => {
                        activeTab.value = tab.value;
                    }, children: tab.label }, tab.value))) }), _jsx(DistHistogram, { histogram: current.histogram, stats: current.stats, tab: activeTab.value })] }));
}
function DistHistogram({ histogram, stats, tab, }) {
    const canvasRef = useRef(null);
    useChart(canvasRef, () => {
        if (histogram.length === 0)
            return null;
        return {
            type: "bar",
            data: {
                labels: histogram.map((b) => b.label),
                datasets: [
                    {
                        label: "Cards",
                        data: histogram.map((b) => b.count),
                        backgroundColor: withAlpha(CHART_COLORS.purple(), 0.7),
                        borderRadius: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const bucket = histogram[ctx.dataIndex];
                                return `${ctx.parsed.y} cards (${bucket === null || bucket === void 0 ? void 0 : bucket.percentage.toFixed(1)}%)`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: CHART_COLORS.muted(), font: { size: 10 } },
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
                        ticks: { color: CHART_COLORS.muted() },
                    },
                },
            },
        };
    }, [histogram, tab]);
    if (histogram.length === 0) {
        return (_jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No data" }));
    }
    return (_jsxs("div", { children: [_jsx("div", { class: "ep:h-40", children: _jsx("canvas", { ref: canvasRef }) }), _jsxs("div", { class: "ep:flex ep:gap-4 ep:mt-2 ep:text-xs ep:text-obs-muted", children: [_jsxs("span", { children: ["Mean: ", stats.mean] }), _jsxs("span", { children: ["Median: ", stats.median] }), _jsxs("span", { children: ["Std Dev: ", stats.stdDev] }), _jsxs("span", { children: ["Count: ", stats.count] })] })] }));
}
