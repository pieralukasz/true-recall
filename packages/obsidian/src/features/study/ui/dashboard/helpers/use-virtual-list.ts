import type { Signal } from "@preact/signals";
import type { RefObject } from "preact";
import { useMemo } from "preact/hooks";

import { isMobile } from "@true-recall/obsidian/utils/platform";

const DESKTOP_ROW_HEIGHT = 36;
const MOBILE_ROW_HEIGHT = 44;
const OVERSCAN = 5;

export const ROW_HEIGHT = isMobile() ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT;

export interface VirtualItem<T> {
	item: T;
	index: number;
	offsetTop: number;
}

export interface ExternalVirtualListOptions<T> {
	items: T[];
	scrollContainerRef: RefObject<HTMLDivElement>;
	scrollTop: Signal<number>;
	contentOffsetRef: RefObject<HTMLDivElement>;
	rowHeight?: number;
}

export function useExternalVirtualList<T>({
	items,
	scrollContainerRef,
	scrollTop,
	contentOffsetRef,
	rowHeight = ROW_HEIGHT,
}: ExternalVirtualListOptions<T>) {
	const totalHeight = items.length * rowHeight;

	const virtualItems = useMemo((): VirtualItem<T>[] => {
		const containerHeight = scrollContainerRef.current?.clientHeight ?? 600;
		const contentOffset = contentOffsetRef.current?.offsetTop ?? 0;
		const effectiveScroll = scrollTop.value - contentOffset;

		if (
			effectiveScroll + containerHeight < 0 ||
			effectiveScroll > totalHeight
		) {
			return [];
		}

		const start = Math.floor(Math.max(0, effectiveScroll) / rowHeight);
		const visibleCount = Math.ceil(containerHeight / rowHeight);
		const from = Math.max(0, start - OVERSCAN);
		const to = Math.min(items.length, start + visibleCount + OVERSCAN);

		const result: VirtualItem<T>[] = [];
		for (let i = from; i < to; i++) {
			const item = items[i];
			if (item === undefined) continue;
			result.push({ item, index: i, offsetTop: i * rowHeight });
		}
		return result;
	}, [items, scrollTop.value, totalHeight, rowHeight]);

	return { totalHeight, virtualItems };
}
