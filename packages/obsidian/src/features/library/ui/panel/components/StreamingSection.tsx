import { useSignalEffect } from "@preact/signals";
import { streamingGeneration } from "@true-recall/core/ai/streaming-state";
import { PartialCard } from "@true-recall/obsidian/features/library/ui/panel/components/PartialCard";
import { useEffect, useRef, useState } from "preact/hooks";

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
	const [, forceUpdate] = useState(0);
	useSignalEffect(() => {
		void streamingGeneration.value;
		forceUpdate((n) => n + 1);
	});

	const streaming = streamingGeneration.value;
	const isActive =
		streaming.isGenerating && streaming.notePath === currentFilePath;

	const sentinelRef = useRef<HTMLDivElement>(null);
	const scrollerRef = useRef<HTMLElement | null>(null);
	const lastScrollRef = useRef(0);
	const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();
	const wasNearBottomRef = useRef(true);

	useEffect(() => {
		if (sentinelRef.current) {
			scrollerRef.current = findScrollParent(sentinelRef.current);
		}
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
			clearTimeout(scrollTimerRef.current);
			scrollTimerRef.current = setTimeout(
				scrollToEnd,
				SCROLL_THROTTLE_MS - elapsed,
			);
		}

		return () => clearTimeout(scrollTimerRef.current);
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
	const [, forceUpdate] = useState(0);
	const prevRef = useRef({
		isGenerating: false,
		completedCount: 0,
		recentCount: 0,
		notePath: null as string | null,
	});

	useSignalEffect(() => {
		const s = streamingGeneration.value;
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
			forceUpdate((n) => n + 1);
		}
	});

	return streamingGeneration.value;
}
