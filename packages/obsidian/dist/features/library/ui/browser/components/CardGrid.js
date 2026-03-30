import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { FSRS_COLORS, MUTED_STATES } from "@true-recall/obsidian/helpers/fsrs-colors";
import { stripMarkdownSyntax } from "@true-recall/core/utils";
import { State } from "ts-fsrs";
const STATE_BADGE = {
    [State.New]: { cls: FSRS_COLORS.new.badgeCls, label: "New" },
    [State.Learning]: { cls: FSRS_COLORS.learning.badgeCls, label: "Lrn" },
    [State.Review]: { cls: FSRS_COLORS.review.badgeCls, label: "Rev" },
    [State.Relearning]: {
        cls: FSRS_COLORS.relearning.badgeCls,
        label: "ReLrn",
    },
    suspended: { cls: FSRS_COLORS.suspended.badgeCls, label: "Sus" },
    buried: { cls: MUTED_STATES.buried.badgeCls, label: "Buried" },
};
export function CardGrid({ cards, selectedIds, onSelect, onPreview, }) {
    if (cards.length === 0) {
        return (_jsx("div", { class: "ep:flex ep:items-center ep:justify-center ep:py-12 ep:text-obs-muted ep:text-sm", children: "No cards match your filters" }));
    }
    return (_jsx("div", { class: "ep:flex ep:flex-col ep:gap-1.5 ep:p-2 ep:overflow-y-auto", children: cards.map((card) => {
            var _a;
            const badgeKey = card.suspended
                ? "suspended"
                : card.buriedUntil && new Date(card.buriedUntil) > new Date()
                    ? "buried"
                    : String(card.state);
            const badge = (_a = STATE_BADGE[badgeKey]) !== null && _a !== void 0 ? _a : {
                cls: MUTED_STATES.unknown.badgeCls,
                label: "?",
            };
            const selected = selectedIds.has(card.id);
            return (_jsxs("div", { class: `ep:p-3 ep:rounded-lg ep:border ep:border-obs-border ep:cursor-pointer ep:transition-colors ${selected
                    ? "ep:bg-obs-interactive/10 ep:border-obs-interactive/30"
                    : "hover:ep:bg-obs-modifier-hover"}`, role: "button", tabIndex: 0, onClick: () => onPreview(card), onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPreview(card);
                    }
                }, onContextMenu: (e) => {
                    e.preventDefault();
                    onSelect(card.id, { ctrlKey: true });
                }, children: [_jsxs("div", { class: "ep:flex ep:items-start ep:justify-between ep:gap-2 ep:mb-1.5", children: [_jsx("span", { class: "ep:text-sm ep:text-obs-normal ep:line-clamp-2 ep:flex-1", children: stripMarkdownSyntax(card.question) }), _jsx("span", { class: `ep:px-1.5 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ep:shrink-0 ${badge.cls}`, children: badge.label })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-[11px] ep:text-obs-muted", children: [card.sourceNoteName && (_jsx("span", { class: "ep:truncate ep:max-w-[120px]", children: card.sourceNoteName })), card.sourceNoteName && (_jsx("span", { class: "ep:opacity-30", children: "\u00B7" })), _jsxs("span", { children: [card.reps, " reps"] }), card.lapses > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { class: "ep:opacity-30", children: "\u00B7" }), _jsxs("span", { class: "ep:text-obs-error", children: [card.lapses, " lapses"] })] }))] })] }, card.id));
        }) }));
}
