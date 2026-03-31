import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
function buildSegments(breakdown, showSuspended) {
    const entries = [
        { label: "New", count: breakdown.new, color: "var(--color-green)" },
        {
            label: "Learning",
            count: breakdown.learning,
            color: "var(--color-orange)",
        },
        {
            label: "Young",
            count: breakdown.young,
            color: "var(--color-blue)",
            opacity: 0.6,
        },
        { label: "Mature", count: breakdown.mature, color: "var(--color-blue)" },
    ];
    if (showSuspended) {
        entries.push({
            label: "Suspended",
            count: breakdown.suspended,
            color: "var(--color-red)",
        }, { label: "Buried", count: breakdown.buried, color: "var(--text-muted)" });
    }
    const total = entries.reduce((sum, e) => sum + e.count, 0);
    if (total === 0)
        return [];
    return entries
        .filter((e) => e.count > 0)
        .map((e) => (Object.assign(Object.assign({}, e), { pct: (e.count / total) * 100 })));
}
export function MaturityWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const showSuspended = configValue(config, "showSuspended", false);
    const data = useComputed(() => {
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const breakdown = statsCalc.getCardMaturityBreakdown();
        const segments = buildSegments(breakdown, showSuspended);
        const total = segments.reduce((sum, s) => sum + s.count, 0);
        return { segments, total };
    }).value;
    if (!data || data.total === 0) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No cards yet" });
    }
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsx("span", { class: "ep:font-semibold", children: "Card Maturity" }), _jsxs("span", { class: "ep:text-obs-muted", children: [data.total, " cards"] })] }), _jsx("div", { class: "ep:flex ep:h-5 ep:rounded ep:overflow-hidden", children: data.segments.map((seg) => (_jsx("div", { style: {
                        width: `${seg.pct}%`,
                        backgroundColor: seg.color,
                        opacity: seg.opacity,
                        minWidth: seg.count > 0 ? "2px" : "0",
                    }, title: `${seg.label}: ${seg.count} (${Math.round(seg.pct)}%)` }, seg.label))) }), _jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-x-3 ep:gap-y-1 ep:text-xs", children: data.segments.map((seg) => (_jsxs("div", { class: "ep:inline-flex ep:items-center ep:gap-1", children: [_jsx("span", { class: "ep:w-2 ep:h-2 ep:rounded-full ep:inline-block ep:shrink-0", style: {
                                backgroundColor: seg.color,
                                opacity: seg.opacity,
                            } }), _jsxs("span", { class: "ep:text-obs-muted", children: [seg.label, " ", seg.count] })] }, seg.label))) })] }));
}
