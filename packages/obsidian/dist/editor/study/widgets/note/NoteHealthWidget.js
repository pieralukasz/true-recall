import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { allCardsArray, cards, cardsBySourceUid, } from "@true-recall/obsidian/services/reactive-card-store";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { State } from "ts-fsrs";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";
export function NoteHealthWidget({ sourceUid, source, }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        var _a, _b;
        void cards.value;
        if (!sourceUid)
            return null;
        const noteCards = (_a = cardsBySourceUid.value.get(sourceUid)) !== null && _a !== void 0 ? _a : [];
        if (noteCards.length === 0)
            return null;
        const now = new Date();
        let totalRetention = 0;
        let totalStability = 0;
        let activeCount = 0;
        let atRiskCount = 0;
        let dueCount = 0;
        // Resolve note name from any card
        const allFsrs = allCardsArray.value;
        const noteCard = allFsrs.find((c) => c.fsrs.sourceUid === sourceUid);
        const sourceNoteName = (_b = noteCard === null || noteCard === void 0 ? void 0 : noteCard.sourceNoteName) !== null && _b !== void 0 ? _b : null;
        for (const card of noteCards) {
            const fsrs = card.fsrs;
            if (fsrs.suspended)
                continue;
            if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
                continue;
            // Due check
            if (fsrs.state === State.Review && new Date(fsrs.due) <= now)
                dueCount++;
            if (fsrs.state === State.Learning || fsrs.state === State.Relearning)
                dueCount++; // learning/relearning always "due"
            // Retrievability (skip new cards)
            if (fsrs.state !== State.New) {
                const r = plugin.fsrsService.getRetrievability(fsrs, now);
                totalRetention += r;
                totalStability += fsrs.stability;
                activeCount++;
                if (r < 0.5)
                    atRiskCount++;
            }
        }
        const avgRetention = activeCount > 0 ? totalRetention / activeCount : 0;
        const avgStability = activeCount > 0 ? totalStability / activeCount : 0;
        return {
            totalCards: noteCards.length,
            avgRetention,
            avgStability,
            atRiskCount,
            dueCount,
            sourceNoteName,
        };
    }).value;
    if (!data) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No flashcards found in this note." }));
    }
    const showActions = configValue(config, "showActions", true);
    const showDetails = configValue(config, "showDetails", true);
    const retentionPct = Math.round(data.avgRetention * 100);
    const barColor = retentionPct >= 90
        ? "var(--color-green)"
        : retentionPct >= 75
            ? "var(--color-cyan)"
            : retentionPct >= 60
                ? "var(--color-orange)"
                : "var(--color-red)";
    const handleReviewDue = () => {
        if (!data.sourceNoteName)
            return;
        plugin
            .openReviewViewWithFilters({
            sourceNoteFilter: data.sourceNoteName,
            ignoreDailyLimits: true,
        })
            .catch(() => { });
    };
    const handleFixWeak = () => {
        if (!data.sourceNoteName)
            return;
        plugin
            .openReviewViewWithFilters({
            sourceNoteFilter: data.sourceNoteName,
            weakCardsOnly: true,
            ignoreDailyLimits: true,
        })
            .catch(() => { });
    };
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-3", children: [_jsxs("span", { class: "ep:text-xs ep:font-semibold ep:whitespace-nowrap", children: ["Health: ", retentionPct, "%"] }), _jsx("div", { class: "ep:flex-1 ep:h-2.5 ep:rounded-full ep:bg-obs-modifier-hover ep:overflow-hidden", children: _jsx("div", { class: "ep:h-full ep:rounded-full ep:transition-all", style: {
                                width: `${retentionPct}%`,
                                backgroundColor: barColor,
                            } }) })] }), showDetails && (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs ep:text-obs-muted ep:flex-wrap", children: [_jsxs("span", { children: [data.totalCards, " cards"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u2502" }), _jsxs("span", { children: ["avg stab: ", formatStability(data.avgStability)] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u2502" }), data.atRiskCount > 0 ? (_jsxs("span", { style: { color: `var(${FSRS_COLORS.suspended.cssVar})` }, children: [data.atRiskCount, " at risk"] })) : (_jsx("span", { class: "ep:text-obs-green", children: "0 at risk" })), _jsx("span", { style: { opacity: 0.4 }, children: "\u2502" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.review.cssVar})` }, children: [data.dueCount, " due"] })] })), showActions && (data.dueCount > 0 || data.atRiskCount > 0) && (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs", children: [data.dueCount > 0 && (_jsx(WidgetCta, { label: `Review ${data.dueCount} due →`, onClick: handleReviewDue })), data.atRiskCount > 0 && (_jsx(WidgetCta, { label: `Fix ${data.atRiskCount} weak →`, onClick: handleFixWeak, variant: "secondary" }))] }))] }));
}
function formatStability(days) {
    if (days < 1)
        return `${Math.round(days * 24)}h`;
    if (days < 30)
        return `${Math.round(days)}d`;
    if (days < 365)
        return `${Math.round(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}y`;
}
