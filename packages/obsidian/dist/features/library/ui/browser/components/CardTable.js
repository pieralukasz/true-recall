import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSignal } from "@preact/signals";
import { Clickable } from "@true-recall/obsidian/components";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { ALL_COLUMNS } from "../helpers/column-defs";
import { shouldLoadMoreCards } from "../helpers/infinite-scroll";
import { CardRow } from "./CardRow";
const ROW_HEIGHT = 36;
const OVERSCAN = 5;
export function CardTable({ cards, sort, onSort, selectedIds, onSelect, onPreview, previewCardId, visibleColumns, scrollContainerRef, hasMore, onReachEnd, }) {
    const scrollTop = useSignal(0);
    const lastLoadTriggerForCount = useRef(-1);
    const columns = useMemo(() => ALL_COLUMNS.filter((col) => visibleColumns.includes(col.key)), [visibleColumns]);
    const gridTemplate = useMemo(() => columns.map((c) => c.width).join(" "), [columns]);
    const totalHeight = cards.length * ROW_HEIGHT;
    const virtualItems = useMemo(() => {
        var _a, _b;
        const containerHeight = (_b = (_a = scrollContainerRef.current) === null || _a === void 0 ? void 0 : _a.clientHeight) !== null && _b !== void 0 ? _b : 600;
        const start = Math.floor(Math.max(0, scrollTop.value) / ROW_HEIGHT);
        const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT);
        const from = Math.max(0, start - OVERSCAN);
        const to = Math.min(cards.length, start + visibleCount + OVERSCAN);
        const result = [];
        for (let i = from; i < to; i++) {
            const card = cards[i];
            if (card)
                result.push({ card, index: i, top: i * ROW_HEIGHT });
        }
        return result;
    }, [cards, scrollTop.value, scrollContainerRef]);
    useEffect(() => {
        // Allow another load request when list grows
        lastLoadTriggerForCount.current = cards.length;
    }, [cards.length]);
    useEffect(() => {
        // If viewport isn't filled, keep loading until we have enough rows or no more.
        const el = scrollContainerRef.current;
        if (!el)
            return;
        if (shouldLoadMoreCards({
            scrollTop: el.scrollTop,
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
        }, hasMore)) {
            onReachEnd();
        }
    }, [cards.length, hasMore, onReachEnd, scrollContainerRef]);
    const handleScroll = useCallback((e) => {
        const target = e.currentTarget;
        scrollTop.value = target.scrollTop;
        const shouldLoad = shouldLoadMoreCards({
            scrollTop: target.scrollTop,
            clientHeight: target.clientHeight,
            scrollHeight: target.scrollHeight,
        }, hasMore);
        if (shouldLoad && lastLoadTriggerForCount.current === cards.length) {
            lastLoadTriggerForCount.current = -1;
            onReachEnd();
        }
    }, [cards.length, hasMore, onReachEnd]);
    if (cards.length === 0) {
        return (_jsx("div", { class: "ep:flex ep:items-center ep:justify-center ep:h-full ep:text-obs-muted ep:text-sm", children: "No cards match your filters" }));
    }
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:h-full", children: [_jsx("div", { class: "ep:grid ep:items-center ep:px-3 ep:h-8 ep:border-b ep:border-obs-border ep:bg-obs-secondary ep:shrink-0 ep:text-[11px] ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wider", style: { gridTemplateColumns: gridTemplate }, children: columns.map((col) => (_jsx(TableHeader, { column: col, sort: sort, onSort: onSort }, col.key))) }), _jsx("div", { ref: scrollContainerRef, class: "ep:flex-1 ep:overflow-y-auto ep:relative", onScroll: handleScroll, children: _jsx("div", { style: { height: `${totalHeight}px`, position: "relative" }, children: virtualItems.map(({ card, top }) => (_jsx(CardRow, { card: card, columns: columns, gridTemplate: gridTemplate, top: top, selected: selectedIds.has(card.id), previewing: previewCardId === card.id, onSelect: onSelect, onPreview: onPreview }, card.id))) }) })] }));
}
function TableHeader({ column, sort, onSort, }) {
    const isActive = sort.column === column.sqlColumn;
    if (!column.sortable) {
        return (_jsx("div", { class: "ep:px-1.5 ep:truncate", style: { textAlign: column.align }, children: column.label }));
    }
    return (_jsxs(Clickable, { class: `ep:px-1.5 ep:truncate ep:flex ep:items-center ep:gap-0.5 ep:cursor-pointer hover:ep:text-obs-normal ${isActive ? "ep:text-obs-normal" : ""}`, style: {
            justifyContent: column.align === "right" ? "flex-end" : "flex-start",
        }, onClick: () => onSort(column.sqlColumn), children: [column.label, isActive && (_jsx("span", { class: "ep:text-[9px]", children: sort.direction === "asc" ? "\u25B2" : "\u25BC" }))] }));
}
