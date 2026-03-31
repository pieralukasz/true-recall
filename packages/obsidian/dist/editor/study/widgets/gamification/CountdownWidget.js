import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { allCardsArray, cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { State } from "ts-fsrs";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";
const URGENCY_COLORS = {
    relaxed: "var(--color-blue)",
    normal: "var(--text-normal)",
    urgent: "var(--color-orange)",
    critical: "var(--color-red)",
};
export function CountdownWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const dateStr = configValue(config, "date", "");
    const data = useComputed(() => {
        void cards.value;
        if (!dateStr)
            return null;
        const targetDate = new Date(dateStr);
        const targetRetention = configValue(config, "target", 90) / 100;
        const label = configValue(config, "label", "Exam");
        const allCards = allCardsArray.value;
        const daysRemaining = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        let cardsAtTarget = 0;
        let cardsAtRisk = 0;
        let newCards = 0;
        for (const card of allCards) {
            if (card.fsrs.suspended)
                continue;
            if (card.fsrs.state === State.New) {
                newCards++;
                continue;
            }
            const predictedR = plugin.fsrsService.getRetrievability(card.fsrs, targetDate);
            if (predictedR >= targetRetention)
                cardsAtTarget++;
            else
                cardsAtRisk++;
        }
        const reviewed = cardsAtTarget + cardsAtRisk;
        const readiness = reviewed > 0 ? Math.round((cardsAtTarget / reviewed) * 100) : 0;
        let urgency;
        if (daysRemaining <= 0)
            urgency = "critical";
        else if (daysRemaining <= 7)
            urgency = "urgent";
        else if (daysRemaining <= 30)
            urgency = "normal";
        else
            urgency = "relaxed";
        return {
            daysRemaining,
            label,
            readiness,
            totalCards: allCards.length,
            cardsAtTarget,
            cardsAtRisk,
            newCardsRemaining: newCards,
            urgency,
        };
    }).value;
    if (!dateStr) {
        return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1.5 ep:p-3 ep:text-xs ep:text-obs-muted", children: [_jsx("span", { children: "Configure a target date:" }), _jsx("pre", { class: "ep:m-0 ep:p-2 ep:rounded ep:bg-obs-modifier-hover ep:text-xs ep:font-mono", children: `date: 2026-06-15\nlabel: Final Exam\ntarget: 90` })] }));
    }
    if (!data) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    if (data.totalCards === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Add flashcards to track readiness" }));
    }
    const readinessColor = data.readiness >= 80
        ? "var(--color-green)"
        : data.readiness >= 50
            ? "var(--color-orange)"
            : "var(--color-red)";
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-baseline ep:justify-between", children: [_jsx("span", { class: "ep:font-semibold ep:text-xs", children: data.label }), _jsxs("div", { class: "ep:flex ep:items-baseline ep:gap-1", children: [_jsx("span", { class: "ep:text-xl ep:font-bold ep:leading-none", style: { color: URGENCY_COLORS[data.urgency] }, children: formatDaysLabel(data.daysRemaining) }), _jsx("span", { class: "ep:text-xs ep:text-obs-muted", children: formatDaysSuffix(data.daysRemaining) })] })] }), _jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsx("span", { children: "Readiness" }), data.readiness === 100 ? (_jsx("span", { class: "ep:font-semibold", style: { color: "var(--color-green)" }, children: "Ready!" })) : (_jsxs("span", { class: "ep:font-semibold", children: [data.readiness, "%"] }))] }), _jsx("div", { class: "ep:h-2.5 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden", children: _jsx("div", { class: "ep:h-full ep:rounded ep:transition-all", style: {
                                width: `${data.readiness}%`,
                                backgroundColor: readinessColor,
                            } }) })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-1.5 ep:text-xs ep:flex-wrap", children: [_jsxs("span", { style: { color: "var(--color-green)" }, children: [data.cardsAtTarget, " ready"] }), data.cardsAtRisk > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { class: "ep:text-obs-faint", children: "\u00B7" }), _jsxs("span", { style: { color: "var(--color-orange)" }, children: [data.cardsAtRisk, " at risk"] })] })), data.newCardsRemaining > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { class: "ep:text-obs-faint", children: "\u00B7" }), _jsxs("span", { children: [data.newCardsRemaining, " new"] })] }))] }), data.cardsAtRisk > 0 && (_jsx("div", { class: "ep:flex ep:justify-end", children: _jsx(WidgetCta, { label: "Review at-risk cards \u2192", onClick: () => void plugin.openCustomStudyModal().catch(() => { }) }) }))] }));
}
function formatDaysLabel(days) {
    if (days <= 0 && days > -1)
        return "Today!";
    if (days < 0)
        return String(Math.abs(days));
    return String(days);
}
function formatDaysSuffix(days) {
    if (days <= 0 && days > -1)
        return "";
    if (days < 0) {
        const absDays = Math.abs(days);
        return absDays === 1 ? "day ago" : "days ago";
    }
    return days === 1 ? "day" : "days";
}
