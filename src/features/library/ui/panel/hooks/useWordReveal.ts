import { animate } from "motion/mini";
import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { StreamingWord } from "./useStreamingText";

/**
 * Imperatively animates new word spans using Motion (Web Animations API + spring physics).
 * Tracks animated indices in a ref to avoid re-triggering on Preact re-renders.
 * Each word span must have a `data-wi="<index>"` attribute for DOM selection.
 * New words must start with inline `opacity: 0; transform: translateY(3px)`.
 */
export function useWordReveal(
	containerRef: RefObject<HTMLElement>,
	words: StreamingWord[],
): void {
	const animatedSet = useRef(new Set<number>());

	// Reset when words drop (new card started — useStreamingText cleared visible count)
	const prevLenRef = useRef(0);
	if (words.length < prevLenRef.current) {
		animatedSet.current.clear();
	}
	prevLenRef.current = words.length;

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const toAnimate: Element[] = [];

		for (let i = 0; i < words.length; i++) {
			if (words[i]!.isNew && !animatedSet.current.has(i)) {
				animatedSet.current.add(i);
				const el = container.querySelector(`[data-wi="${i}"]`);
				if (el) toAnimate.push(el);
			}
		}

		if (toAnimate.length === 0) return;

		for (const el of toAnimate) {
			animate(
				el,
				{ opacity: 1, transform: "translateY(0)" },
				{ type: "spring", stiffness: 400, damping: 30 },
			);
		}
	});
}
