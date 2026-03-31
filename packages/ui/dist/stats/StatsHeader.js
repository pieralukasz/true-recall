import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "../shared/Clickable";
import { cn } from "../utils/cn";
const TIME_RANGES = [
    { value: "1m", label: "1M" },
    { value: "3m", label: "3M" },
    { value: "1y", label: "1Y" },
    { value: "all", label: "All" },
];
export function StatsHeader({ timeRange }) {
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between", children: [_jsx("h2", { class: "ep:text-base ep:font-semibold ep:text-obs-normal", children: "Statistics" }), _jsx("div", { class: "ep:flex ep:gap-1 ep:bg-obs-secondary ep:rounded-lg ep:p-0.5", children: TIME_RANGES.map((range) => (_jsx(Clickable, { role: "tab", "aria-selected": timeRange.value === range.value, class: cn("ep:px-3 ep:py-1 ep:text-xs ep:font-medium ep:rounded-md ep:transition-colors", timeRange.value === range.value
                        ? "ep:bg-obs-interactive/15 ep:text-obs-interactive"
                        : "ep:text-obs-muted ep:hover:text-obs-normal"), onClick: () => {
                        timeRange.value = range.value;
                    }, children: range.label }, range.value))) })] }));
}
