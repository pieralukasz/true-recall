import { useSignal } from "@preact/signals";
import { useCallback, useMemo, useRef } from "preact/hooks";
import type { RefObject } from "preact";

const ROW_HEIGHT = 56;
const OVERSCAN = 5;

export interface VirtualItem<T> {
	item: T;
	index: number;
	offsetTop: number;
}

export function useVirtualList<T>(items: T[]) {
	const containerRef = useRef<HTMLDivElement>(null);
	const scrollTop = useSignal(0);

	const onScroll = useCallback((e: Event) => {
		const target = e.currentTarget as HTMLDivElement;
		scrollTop.value = target.scrollTop;
	}, []);

	const totalHeight = items.length * ROW_HEIGHT;

	const virtualItems = useMemo((): VirtualItem<T>[] => {
		const containerHeight = containerRef.current?.clientHeight ?? 600;
		const start = Math.floor(scrollTop.value / ROW_HEIGHT);
		const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT);

		const from = Math.max(0, start - OVERSCAN);
		const to = Math.min(items.length, start + visibleCount + OVERSCAN);

		const result: VirtualItem<T>[] = [];
		for (let i = from; i < to; i++) {
			const item = items[i];
			if (item === undefined) continue;
			result.push({ item, index: i, offsetTop: i * ROW_HEIGHT });
		}
		return result;
	}, [items, scrollTop.value]);

	return {
		containerRef: containerRef as RefObject<HTMLDivElement>,
		totalHeight,
		virtualItems,
		onScroll,
	};
}
