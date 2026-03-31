import { useMemo } from "preact/hooks";
const ROW_HEIGHT = 36;
const OVERSCAN = 5;
export function useExternalVirtualList({ items, scrollContainerRef, scrollTop, contentOffsetRef, rowHeight = ROW_HEIGHT, }) {
    const totalHeight = items.length * rowHeight;
    const virtualItems = useMemo(() => {
        var _a, _b, _c, _d;
        const containerHeight = (_b = (_a = scrollContainerRef.current) === null || _a === void 0 ? void 0 : _a.clientHeight) !== null && _b !== void 0 ? _b : 600;
        const contentOffset = (_d = (_c = contentOffsetRef.current) === null || _c === void 0 ? void 0 : _c.offsetTop) !== null && _d !== void 0 ? _d : 0;
        const effectiveScroll = scrollTop.value - contentOffset;
        if (effectiveScroll + containerHeight < 0 ||
            effectiveScroll > totalHeight) {
            return [];
        }
        const start = Math.floor(Math.max(0, effectiveScroll) / rowHeight);
        const visibleCount = Math.ceil(containerHeight / rowHeight);
        const from = Math.max(0, start - OVERSCAN);
        const to = Math.min(items.length, start + visibleCount + OVERSCAN);
        const result = [];
        for (let i = from; i < to; i++) {
            const item = items[i];
            if (item === undefined)
                continue;
            result.push({ item, index: i, offsetTop: i * rowHeight });
        }
        return result;
    }, [items, scrollTop.value, totalHeight, rowHeight]);
    return { totalHeight, virtualItems };
}
