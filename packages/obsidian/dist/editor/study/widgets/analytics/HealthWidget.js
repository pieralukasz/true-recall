import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
export function HealthWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        return statsCalc.getCollectionHealthSnapshot();
    }).value;
    if (!data || data.cardCount === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No active cards yet." }));
    }
    const showBuckets = configValue(config, "showBuckets", true);
    const targetPct = configValue(config, "target", 90);
    const retention = data.averageRetention;
    const barColor = retention >= targetPct
        ? "var(--color-green)"
        : retention >= targetPct - 15
            ? "var(--color-cyan)"
            : retention >= targetPct - 30
                ? "var(--color-orange)"
                : "var(--color-red)";
    const handleBarClick = () => {
        plugin
            .openReviewViewWithFilters({ overdueOnly: true, ignoreDailyLimits: true })
            .catch(() => { });
    };
    const handleBucketClick = (bucketIdx) => {
        // Map bucket index to stability range for review filter
        // Buckets: 0=Strong (>90%), 1=High (75-90%), 2=Medium (50-75%), 3=Low (25-50%), 4=At risk (<25%)
        const ranges = [
            { min: 50, max: 999 },
            { min: 20, max: 50 },
            { min: 5, max: 20 },
            { min: 1, max: 5 },
            { min: 0, max: 1 },
        ];
        const range = ranges[bucketIdx];
        if (!range)
            return;
        plugin
            .openReviewViewWithFilters({
            stabilityRange: range,
            ignoreDailyLimits: true,
        })
            .catch(() => { });
    };
    const maxBucket = Math.max(1, ...data.distribution.map((b) => b.count));
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsx("span", { class: "ep:font-semibold", children: "Memory Health" }), _jsxs("span", { class: "ep:font-semibold", children: [retention, "%"] })] }), _jsxs(Clickable, { onClick: handleBarClick, title: "Review overdue cards", children: [_jsxs("div", { class: "ep:h-3 ep:rounded-full ep:bg-obs-modifier-hover ep:overflow-hidden ep:relative", children: [_jsx("div", { class: "ep:h-full ep:rounded-full ep:transition-all", style: {
                                    width: `${retention}%`,
                                    backgroundColor: barColor,
                                } }), _jsx("div", { class: "ep:absolute ep:top-0 ep:h-full ep:w-px ep:bg-obs-text-normal ep:opacity-40", style: { left: `${targetPct}%` } })] }), _jsxs("div", { class: "ep:text-right ep:text-xs ep:text-obs-muted ep:mt-0.5", children: ["target: ", targetPct, "%"] })] }), showBuckets && data.distribution.length > 0 && (_jsxs("div", { class: "ep:flex ep:items-end ep:gap-2 ep:justify-between", children: [data.distribution.map((bucket, idx) => (_jsxs(Clickable, { class: "ep:flex ep:flex-col ep:items-center ep:gap-1 hover:ep:opacity-80 ep:flex-1", onClick: () => handleBucketClick(idx), title: `Review ${bucket.label} cards`, children: [_jsx("span", { class: "ep:text-xs ep:text-obs-muted", children: bucket.label }), _jsx("span", { class: "ep:text-xs ep:font-semibold", children: bucket.count }), _jsx("div", { class: "ep:w-full ep:rounded ep:min-h-[2px]", style: {
                                    height: `${Math.max(2, (bucket.count / maxBucket) * 24)}px`,
                                    backgroundColor: `var(${bucket.colorVar})`,
                                } })] }, bucket.label))), _jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:gap-1 ep:pl-2", children: [_jsx("span", { class: "ep:text-xs ep:text-obs-muted", children: "\u00A0" }), _jsxs("span", { class: "ep:text-xs ep:text-obs-muted", children: [data.cardCount, " active"] })] })] }))] }));
}
