import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
export function RangeSummary({ data }) {
    return (_jsxs("div", { class: "ep:rounded-lg ep:border ep:border-obs-modifier-border ep:bg-obs-primary ep:p-4", children: [_jsx("h3", { class: "ep:text-sm ep:font-semibold ep:text-obs-normal ep:mb-3", children: "Period Summary" }), _jsxs("div", { class: "ep:grid ep:grid-cols-2 sm:ep:grid-cols-4 ep:gap-3 ep:text-xs", children: [_jsx(SummaryStat, { label: "Days studied", value: `${data.daysStudied}/${data.totalDays}` }), _jsx(SummaryStat, { label: "Total reviews", value: data.totalReviews.toLocaleString() }), _jsx(SummaryStat, { label: "Avg/day", value: String(data.avgPerDay) }), _jsx(SummaryStat, { label: "Avg (studied days)", value: String(data.avgForStudiedDays) }), _jsx(SummaryStat, { label: "Daily load", value: String(data.dailyLoad) }), _jsx(SummaryStat, { label: "Due tomorrow", value: String(data.dueTomorrow) })] })] }));
}
function SummaryStat({ label, value }) {
    return (_jsxs("div", { children: [_jsx("div", { class: "ep:text-obs-muted", children: label }), _jsx("div", { class: "ep:text-sm ep:font-semibold ep:text-obs-normal", children: value })] }));
}
