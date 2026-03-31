import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { getThemeColor } from "./chart-theme";
import { ChartCard } from "./ChartCard";
export function CollectionHealthBar({ data }) {
    if (data.cardCount === 0) {
        return (_jsx(ChartCard, { title: "Collection Health", subtitle: "Predicted retention distribution", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center", children: "No cards yet" }) }));
    }
    const segments = data.distribution.map((bucket) => ({
        pct: Math.round((bucket.count / data.cardCount) * 100),
        color: getThemeColor(bucket.colorVar),
        label: `${bucket.label}: ${bucket.count}`,
    }));
    return (_jsxs(ChartCard, { title: "Collection Health", subtitle: `${data.cardCount} cards \u00B7 ${Math.round(data.averageRetention)}% avg retention`, children: [_jsx("div", { class: "ep:h-3 ep:rounded-full ep:overflow-hidden ep:flex ep:mb-3", children: segments
                    .filter((s) => s.pct > 0)
                    .map((s) => (_jsx("div", { style: { width: `${s.pct}%`, backgroundColor: s.color }, title: s.label }, s.label))) }), _jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-3 ep:text-xs ep:text-obs-muted", children: segments
                    .filter((s) => s.pct > 0)
                    .map((s) => (_jsxs("span", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx("span", { class: "ep:inline-block ep:w-2 ep:h-2 ep:rounded-sm", style: { backgroundColor: s.color } }), s.label] }, s.label))) })] }));
}
