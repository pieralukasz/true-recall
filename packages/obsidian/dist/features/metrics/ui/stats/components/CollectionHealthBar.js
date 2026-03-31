import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { getThemeColor } from "../helpers/chart-theme";
import { ChartCard } from "./ChartCard";
export function CollectionHealthBar({ data }) {
    if (data.cardCount === 0) {
        return (_jsx(ChartCard, { title: "Collection Health", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-4 ep:text-center", children: "No active cards" }) }));
    }
    return (_jsxs(ChartCard, { title: "Collection Health", subtitle: `Average retention: ${data.averageRetention}% across ${data.cardCount} cards`, children: [_jsx("div", { class: "ep:flex ep:h-6 ep:rounded-md ep:overflow-hidden ep:border ep:border-obs-modifier-border", children: data.distribution.map((bucket) => {
                    const width = data.cardCount > 0 ? (bucket.count / data.cardCount) * 100 : 0;
                    if (width === 0)
                        return null;
                    return (_jsx("div", { title: `${bucket.label}: ${bucket.count} cards (${Math.round(width)}%)`, style: {
                            width: `${width}%`,
                            backgroundColor: getThemeColor(bucket.colorVar),
                            minWidth: bucket.count > 0 ? "2px" : "0",
                        } }, bucket.label));
                }) }), _jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:mt-2 ep:text-xs ep:text-obs-muted", children: data.distribution.map((bucket) => (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1.5", children: [_jsx("div", { class: "ep:w-2.5 ep:h-2.5 ep:rounded-sm", style: { backgroundColor: getThemeColor(bucket.colorVar) } }), _jsxs("span", { children: [bucket.label, ": ", bucket.count] })] }, bucket.label))) })] }));
}
