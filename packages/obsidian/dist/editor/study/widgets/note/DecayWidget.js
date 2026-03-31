import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import { allCardsArray, cards, cardsBySourceUid, } from "@true-recall/obsidian/services/reactive-card-store";
import { useMemo } from "preact/hooks";
import { State } from "ts-fsrs";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";
export function DecayWidget({ sourceUid, source, }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        var _a, _b, _c;
        void cards.value;
        if (!sourceUid)
            return null;
        const noteCards = (_a = cardsBySourceUid.value.get(sourceUid)) !== null && _a !== void 0 ? _a : [];
        if (noteCards.length === 0)
            return null;
        const now = new Date();
        const targetRetention = configValue(config, "target", 0.9);
        const limit = configValue(config, "limit", 10);
        const sortBy = configValue(config, "sort", "retrievability");
        // Resolve note name
        const allFsrs = allCardsArray.value;
        const noteCard = allFsrs.find((c) => c.fsrs.sourceUid === sourceUid);
        const sourceNoteName = (_b = noteCard === null || noteCard === void 0 ? void 0 : noteCard.sourceNoteName) !== null && _b !== void 0 ? _b : null;
        const decayCards = [];
        let totalRetention = 0;
        let activeCount = 0;
        let atRiskCount = 0;
        for (const card of noteCards) {
            const fsrs = card.fsrs;
            if (fsrs.suspended)
                continue;
            if (fsrs.state === State.New)
                continue; // skip new cards — no retrievability
            const r = plugin.fsrsService.getRetrievability(fsrs, now);
            totalRetention += r;
            activeCount++;
            if (r < 0.5)
                atRiskCount++;
            decayCards.push({
                id: card.id,
                question: truncateQuestion("question" in card
                    ? ((_c = card.question) !== null && _c !== void 0 ? _c : "Card")
                    : "Card"),
                retrievability: r,
                stability: fsrs.stability,
                sourceNoteName,
            });
        }
        // Sort
        decayCards.sort((a, b) => {
            switch (sortBy) {
                case "stability":
                    return a.stability - b.stability;
                case "due":
                    return a.retrievability - b.retrievability;
                default: // retrievability (lowest first)
                    return a.retrievability - b.retrievability;
            }
        });
        return {
            cards: decayCards.slice(0, limit),
            totalCards: noteCards.length,
            avgRetention: activeCount > 0 ? totalRetention / activeCount : 0,
            atRiskCount,
            targetRetention,
            sourceNoteName,
        };
    }).value;
    if (!data) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "No flashcards found in this note." }));
    }
    const showTarget = configValue(config, "showTarget", true);
    const showStability = configValue(config, "showStability", true);
    const remainingCount = data.totalCards - data.cards.length;
    const targetPct = Math.round(data.targetRetention * 100);
    const handleReviewAtRisk = () => {
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
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsx("span", { class: "ep:font-semibold", children: "Memory Decay" }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsxs("span", { class: "ep:text-obs-muted", children: [data.totalCards, " cards"] }), showTarget && (_jsxs("span", { class: "ep:text-obs-muted", children: ["target: ", targetPct, "%"] }))] })] }), _jsx("div", { class: "ep:flex ep:flex-col ep:gap-1", children: data.cards.map((card) => {
                    const pct = Math.round(card.retrievability * 100);
                    const belowTarget = card.retrievability < data.targetRetention;
                    const barColor = belowTarget
                        ? card.retrievability < 0.5
                            ? "var(--color-red)"
                            : "var(--color-orange)"
                        : "var(--color-green)";
                    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs", title: card.question, children: [_jsxs("span", { class: "ep:w-24 ep:truncate ep:text-obs-muted", children: [card.question, showStability && (_jsxs("span", { class: "ep:ml-1 ep:opacity-60", children: ["(", formatStability(card.stability), ")"] }))] }), _jsxs("div", { class: "ep:flex-1 ep:h-2.5 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden ep:relative", children: [_jsx("div", { class: "ep:h-full ep:rounded", style: {
                                            width: `${pct}%`,
                                            backgroundColor: barColor,
                                        } }), showTarget && (_jsx("div", { class: "ep:absolute ep:top-0 ep:h-full ep:w-px ep:bg-obs-text-normal ep:opacity-40", style: { left: `${targetPct}%` } }))] }), _jsxs("span", { class: "ep:w-8 ep:text-right ep:font-semibold", style: { color: belowTarget ? barColor : undefined }, children: [pct, "%"] })] }, card.id));
                }) }), _jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: [remainingCount > 0 && (_jsxs("span", { class: "ep:text-obs-muted", children: ["... ", remainingCount, " more (avg:", " ", Math.round(data.avgRetention * 100), "%)"] })), remainingCount === 0 && (_jsxs("span", { class: "ep:text-obs-muted", children: ["avg: ", Math.round(data.avgRetention * 100), "%"] })), data.atRiskCount > 0 && (_jsx(WidgetCta, { label: `Review at-risk (${data.atRiskCount}) →`, onClick: handleReviewAtRisk }))] })] }));
}
function truncateQuestion(q) {
    const clean = q.replace(/[#*_`~[\]]/g, "").trim();
    if (clean.length <= 30)
        return clean;
    return `${clean.slice(0, 27)}...`;
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
