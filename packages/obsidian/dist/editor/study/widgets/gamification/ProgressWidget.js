import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";
function ProgressRing({ value, max, color, radius, stroke, }) {
    const circumference = 2 * Math.PI * radius;
    const progress = max > 0 ? Math.min(value / max, 1) : 0;
    const offset = circumference * (1 - progress);
    return (_jsx("circle", { r: radius, cx: radius + stroke + 4, cy: radius + stroke + 4, fill: "none", stroke: color, "stroke-width": stroke, "stroke-dasharray": `${circumference}`, "stroke-dashoffset": `${offset}`, "stroke-linecap": "round", style: { transform: "rotate(-90deg)", transformOrigin: "center" } }));
}
function RingTrack({ radius, stroke }) {
    return (_jsx("circle", { r: radius, cx: radius + stroke + 4, cy: radius + stroke + 4, fill: "none", stroke: "var(--background-modifier-hover)", "stroke-width": stroke }));
}
export function ProgressWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const todaySummary = statsCalc.getTodaySummary();
        const preset = plugin.presetService.getDefaultPreset();
        const newDone = todaySummary.newCards;
        const newCap = preset.newCardsPerDay;
        const reviewDone = todaySummary.reviewCards;
        const reviewCap = preset.reviewsPerDay;
        const totalDone = newDone + reviewDone;
        const totalCap = newCap + reviewCap;
        const minutesPerCard = todaySummary.studied > 0
            ? todaySummary.minutes / todaySummary.studied
            : 0.5;
        const remaining = Math.max(0, newCap - newDone) + Math.max(0, reviewCap - reviewDone);
        const estimatedMinutesRemaining = Math.round(remaining * minutesPerCard);
        const allDone = newDone >= newCap && reviewDone >= reviewCap;
        return {
            newDone,
            newCap,
            reviewDone,
            reviewCap,
            totalDone,
            totalCap,
            estimatedMinutesRemaining,
            allDone,
        };
    }).value;
    if (!data) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    const showTime = configValue(config, "showTime", true);
    const style = configValue(config, "style", "ring");
    const handleClick = () => {
        plugin.openCustomStudyModal().catch(() => { });
    };
    if (data.totalCap === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No daily limits configured." }));
    }
    if (data.allDone) {
        return (_jsxs(Clickable, { class: "ep:flex ep:flex-col ep:items-center ep:gap-1 ep:p-3", onClick: handleClick, children: [_jsx("span", { class: "ep:text-obs-green ep:text-sm ep:font-semibold", children: "\u2713 All done for today!" }), _jsxs("span", { class: "ep:text-obs-muted ep:text-xs", children: [data.totalDone, " cards reviewed"] })] }));
    }
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsx(Clickable, { class: "ep:flex ep:flex-col ep:items-center ep:gap-2", onClick: handleClick, children: style === "ring" ? _jsx(RingView, { data: data }) : _jsx(BarView, { data: data }) }), _jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [showTime && data.estimatedMinutesRemaining > 0 && (_jsxs("span", { class: "ep:text-obs-muted", children: ["~", data.estimatedMinutesRemaining, "m remaining"] })), _jsx("span", { class: "ep:ml-auto", children: _jsx(WidgetCta, { label: "Study \u2192", onClick: handleClick }) })] })] }));
}
function RingView({ data }) {
    const outerRadius = 36;
    const innerRadius = 26;
    const stroke = 5;
    const size = (outerRadius + stroke + 4) * 2;
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:gap-1", children: [_jsxs("svg", { width: size, height: size, "aria-hidden": "true", children: [_jsx(RingTrack, { radius: outerRadius, stroke: stroke }), _jsx(ProgressRing, { value: data.reviewDone, max: data.reviewCap, color: "var(--color-blue)", radius: outerRadius, stroke: stroke }), _jsx(RingTrack, { radius: innerRadius, stroke: stroke }), _jsx(ProgressRing, { value: data.newDone, max: data.newCap, color: "var(--color-green)", radius: innerRadius, stroke: stroke }), _jsxs("text", { x: size / 2, y: size / 2, "text-anchor": "middle", "dominant-baseline": "central", fill: "currentColor", "font-size": "12", "font-weight": "600", children: [data.totalDone, "/", data.totalCap] })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-3 ep:text-xs ep:text-obs-muted", children: [_jsxs("span", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx("span", { class: "ep:inline-block ep:w-2 ep:h-2 ep:rounded-full", style: { background: "var(--color-green)" } }), "New"] }), _jsxs("span", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx("span", { class: "ep:inline-block ep:w-2 ep:h-2 ep:rounded-full", style: { background: "var(--color-blue)" } }), "Reviews"] })] })] }));
}
function BarView({ data }) {
    const newPct = data.newCap > 0 ? Math.min(data.newDone / data.newCap, 1) * 100 : 0;
    const reviewPct = data.reviewCap > 0
        ? Math.min(data.reviewDone / data.reviewCap, 1) * 100
        : 0;
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:w-full", children: [_jsx(ProgressBar, { label: "New", value: data.newDone, max: data.newCap, pct: newPct, color: "var(--color-green)" }), _jsx(ProgressBar, { label: "Reviews", value: data.reviewDone, max: data.reviewCap, pct: reviewPct, color: "var(--color-blue)" })] }));
}
function ProgressBar({ label, value, max, pct, color, }) {
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs", children: [_jsx("span", { class: "ep:w-14 ep:text-obs-muted", children: label }), _jsx("div", { class: "ep:flex-1 ep:h-2 ep:rounded-full ep:overflow-hidden", style: { background: "var(--background-modifier-hover)" }, children: _jsx("div", { class: "ep:h-full ep:rounded-full ep:transition-all", style: { width: `${pct}%`, background: color } }) }), _jsxs("span", { class: "ep:w-10 ep:text-right ep:text-obs-muted", children: [value, "/", max] })] }));
}
