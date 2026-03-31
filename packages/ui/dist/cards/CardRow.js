import { jsx as _jsx } from "preact/jsx-runtime";
import { FSRS_COLORS, MUTED_STATES } from "../helpers/fsrs-colors";
import { stripMarkdownSyntax } from "../utils/strip-markdown";
import { State } from "ts-fsrs";
const STATE_BADGE_CLS = {
    [State.New]: FSRS_COLORS.new.badgeCls,
    [State.Learning]: FSRS_COLORS.learning.badgeCls,
    [State.Review]: FSRS_COLORS.review.badgeCls,
    [State.Relearning]: FSRS_COLORS.relearning.badgeCls,
    suspended: FSRS_COLORS.suspended.badgeCls,
    buried: MUTED_STATES.buried.badgeCls,
};
export function CardRow({ card, columns, gridTemplate, top, selected, previewing, onSelect, onPreview, }) {
    const rowCls = [
        "ep:grid ep:items-center ep:px-3 ep:h-9 ep:text-ui-small ep:cursor-pointer ep:border-b ep:border-obs-border/50",
        "hover:ep:bg-obs-modifier-hover ep:transition-colors",
        selected
            ? "ep:bg-obs-interactive/10"
            : previewing
                ? "ep:bg-obs-modifier-hover/50"
                : "",
    ].join(" ");
    return (_jsx("div", { class: rowCls, style: {
            gridTemplateColumns: gridTemplate,
            position: "absolute",
            top: `${top}px`,
            left: 0,
            right: 0,
            height: "36px",
        }, role: "button", tabIndex: 0, onClick: (e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                onSelect(card.id, {
                    shiftKey: e.shiftKey,
                    ctrlKey: e.ctrlKey,
                    metaKey: e.metaKey,
                });
            }
            else {
                onPreview(card);
            }
        }, onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPreview(card);
            }
        }, onContextMenu: (e) => {
            e.preventDefault();
            onSelect(card.id, { ctrlKey: true });
        }, children: columns.map((col) => (_jsx(CellRenderer, { column: col, card: card }, col.key))) }));
}
function CellRenderer({ column, card, }) {
    var _a;
    const value = column.accessor(card);
    if (column.key === "state") {
        const badgeKey = card.suspended
            ? "suspended"
            : card.buriedUntil && new Date(card.buriedUntil) > new Date()
                ? "buried"
                : String(card.state);
        const cls = (_a = STATE_BADGE_CLS[badgeKey]) !== null && _a !== void 0 ? _a : MUTED_STATES.unknown.badgeCls;
        return (_jsx("div", { class: "ep:flex ep:justify-center", children: _jsx("span", { class: `ep:px-1.5 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ${cls}`, children: value }) }));
    }
    if (column.key === "question" || column.key === "answer") {
        return (_jsx("div", { class: "ep:px-1.5 ep:truncate ep:text-obs-normal", title: value, children: stripMarkdownSyntax(value) }));
    }
    return (_jsx("div", { class: "ep:px-1.5 ep:truncate ep:text-obs-muted", style: { textAlign: column.align }, children: value }));
}
