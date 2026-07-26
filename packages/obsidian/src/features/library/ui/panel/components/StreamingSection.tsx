import { useEffect, useRef, useState } from "preact/hooks";

import { streamingGeneration } from "@true-recall/core/ai/state/streaming-state";

import { PartialCard } from "@true-recall/obsidian/features/library/ui/panel/components/PartialCard";

const SCROLL_THROTTLE_MS = 250;
const NEAR_BOTTOM_PX = 80;

function findScrollParent(el: HTMLElement): HTMLElement | null {
	let node = el.parentElement;
	while (node) {
		const { overflowY } = getComputedStyle(node);
		if (overflowY === "auto" || overflowY === "scroll") return node;
		node = node.parentElement;
	}
	return null;
}

function isNearBottom(scroller: HTMLElement): boolean {
	return (
		scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
		NEAR_BOTTOM_PX
	);
}

export function StreamingSection({
	currentFilePath,
}: {
	currentFilePath: string | null;
}) {
	const [streaming, setStreaming] = useState(streamingGeneration.value);
	useEffect(() => streamingGeneration.subscribe(setStreaming), []);
	const isActive =
		streaming.isGenerating && streaming.notePath === currentFilePath;

	const sentinelRef = useRef<HTMLDivElement>(null);
	const scrollerRef = useRef<HTMLElement | null>(null);
	const lastScrollRef = useRef(0);
	const scrollTimerRef = useRef<number>();
	const wasNearBottomRef = useRef(true);

	useEffect(() => {
		if (sentinelRef.current) {
			scrollerRef.current = findScrollParent(sentinelRef.current);
		}
		// Mount = generation just started for this note. Jump to the bottom so
		// streamed cards are visible, then re-pin once the virtualizer has
		// measured real row heights (estimates can shift scrollHeight).
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const scrollToEnd = () => {
			scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
		};
		scrollToEnd();
		wasNearBottomRef.current = true;
		const raf = window.requestAnimationFrame(scrollToEnd);
		return () => cancelAnimationFrame(raf);
	}, []);

	useEffect(() => {
		if (!isActive) return;
		const scroller = scrollerRef.current;
		if (!scroller) return;

		const nearBottom = isNearBottom(scroller);
		if (nearBottom) wasNearBottomRef.current = true;
		if (!nearBottom && !wasNearBottomRef.current) return;
		if (!nearBottom) {
			wasNearBottomRef.current = false;
			return;
		}

		const scrollToEnd = () => {
			scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
			lastScrollRef.current = Date.now();
		};

		const now = Date.now();
		const elapsed = now - lastScrollRef.current;

		if (elapsed >= SCROLL_THROTTLE_MS) {
			scrollToEnd();
		} else {
			window.clearTimeout(scrollTimerRef.current);
			scrollTimerRef.current = window.setTimeout(
				scrollToEnd,
				SCROLL_THROTTLE_MS - elapsed,
			);
		}

		return () => window.clearTimeout(scrollTimerRef.current);
	});

	if (!isActive) return null;

	return (
		<>
			<PartialCard streaming={streaming} />
			<div ref={sentinelRef} />
		</>
	);
}

export function useStreamingCardState() {
	const [state, setState] = useState(streamingGeneration.value);
	const prevRef = useRef({
		isGenerating: false,
		completedCount: 0,
		recentCount: 0,
		notePath: null as string | null,
	});

	useEffect(
		() =>
			streamingGeneration.subscribe((s) => {
				const prev = prevRef.current;
				if (
					prev.isGenerating !== s.isGenerating ||
					prev.completedCount !== s.completedCards.length ||
					prev.recentCount !== s.recentCardIds.size ||
					prev.notePath !== s.notePath
				) {
					prevRef.current = {
						isGenerating: s.isGenerating,
						completedCount: s.completedCards.length,
						recentCount: s.recentCardIds.size,
						notePath: s.notePath,
					};
					setState(s);
				}
			}),
		[],
	);

	return state;
}
