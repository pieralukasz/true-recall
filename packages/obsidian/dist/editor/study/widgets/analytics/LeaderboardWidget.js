import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { allCardsArray, cards } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";
export function LeaderboardWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const noteRows = statsCalc.getNotePerformance();
        if (noteRows.length === 0)
            return null;
        const limit = configValue(config, "limit", 5);
        const sortBy = configValue(config, "sort", "retention");
        const order = configValue(config, "order", "asc");
        // Resolve note names from sourceUid
        const allCards = allCardsArray.value;
        const uidToName = new Map();
        for (const card of allCards) {
            if (card.fsrs.sourceUid && card.sourceNoteName) {
                uidToName.set(card.fsrs.sourceUid, card.sourceNoteName);
            }
        }
        const entries = noteRows
            .filter((row) => row.cardCount > 0)
            .map((row) => {
            var _a;
            return (Object.assign(Object.assign({}, row), { resolvedName: (_a = uidToName.get(row.sourceUid)) !== null && _a !== void 0 ? _a : row.sourceUid }));
        });
        // Sort
        entries.sort((a, b) => {
            var _a, _b, _c, _d, _e, _f;
            let cmp = 0;
            switch (sortBy) {
                case "lapses":
                    cmp = ((_a = b.avgLapses) !== null && _a !== void 0 ? _a : 0) - ((_b = a.avgLapses) !== null && _b !== void 0 ? _b : 0);
                    break;
                case "lastReviewed":
                    cmp = ((_c = a.lastReviewed) !== null && _c !== void 0 ? _c : "").localeCompare((_d = b.lastReviewed) !== null && _d !== void 0 ? _d : "");
                    break;
                case "cards":
                    cmp = b.cardCount - a.cardCount;
                    break;
                default: // retention (lowest first = worst performing)
                    cmp = ((_e = a.retentionRate) !== null && _e !== void 0 ? _e : 0) - ((_f = b.retentionRate) !== null && _f !== void 0 ? _f : 0);
                    break;
            }
            return order === "desc" ? -cmp : cmp;
        });
        return entries.slice(0, limit);
    }).value;
    if (!data || data.length === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No notes with flashcards yet." }));
    }
    const warnBelow = configValue(config, "warnBelow", 75);
    const dangerBelow = configValue(config, "dangerBelow", 65);
    const handleNoteClick = (name) => {
        plugin
            .openReviewViewWithFilters({
            sourceNoteFilter: name,
            ignoreDailyLimits: true,
        })
            .catch(() => { });
    };
    const handleReviewWeakest = () => {
        const first = data.length > 0 ? data[0] : undefined;
        if (first) {
            handleNoteClick(first.resolvedName);
        }
    };
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsx("span", { class: "ep:font-semibold", children: "Note Leaderboard" }), _jsxs("span", { class: "ep:text-obs-muted", children: ["sort: ", configValue(config, "sort", "retention")] })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:text-xs ep:text-obs-muted ep:gap-2", children: [_jsx("span", { class: "ep:w-4 ep:text-right", children: "#" }), _jsx("span", { class: "ep:flex-1", children: "Note" }), _jsx("span", { class: "ep:w-10 ep:text-right", children: "Cards" }), _jsx("span", { class: "ep:w-16 ep:text-right", children: "Retention" }), _jsx("span", { class: "ep:w-10 ep:text-right", children: "Lapses" })] }), data.map((entry, idx) => {
                const retention = entry.retentionRate != null ? Math.round(entry.retentionRate) : null;
                const warningLevel = retention != null && retention < dangerBelow
                    ? "danger"
                    : retention != null && retention < warnBelow
                        ? "warn"
                        : "ok";
                return (_jsxs(Clickable, { class: "ep:flex ep:items-center ep:text-xs ep:gap-2 hover:ep:bg-obs-modifier-hover ep:rounded ep:px-1 ep:py-0.5", onClick: () => handleNoteClick(entry.resolvedName), title: `Review ${entry.resolvedName}`, children: [_jsx("span", { class: "ep:w-4 ep:text-right ep:text-obs-muted", children: idx + 1 }), _jsx("span", { class: "ep:flex-1 ep:truncate", children: entry.resolvedName }), _jsx("span", { class: "ep:w-10 ep:text-right", children: entry.cardCount }), _jsxs("span", { class: "ep:w-16 ep:text-right ep:font-semibold", style: {
                                color: warningLevel === "danger"
                                    ? "var(--color-red)"
                                    : warningLevel === "warn"
                                        ? "var(--color-orange)"
                                        : undefined,
                            }, children: [retention != null ? `${retention}%` : "—", warningLevel === "danger" && " !!", warningLevel === "warn" && " !"] }), _jsx("span", { class: "ep:w-10 ep:text-right ep:text-obs-muted", children: entry.avgLapses.toFixed(1) })] }, entry.sourceUid));
            }), _jsx("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: _jsx(WidgetCta, { label: "Review weakest \u2192", onClick: handleReviewWeakest }) })] }));
}
