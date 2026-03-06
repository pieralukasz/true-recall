import { animate } from "motion/mini";
import { spring } from "motion-dom";
import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { StreamingWord } from "./useStreamingText";

/**
 * Imperatively animates new word spans using Motion mini (WAAPI + spring physics).
 * Tracks animated indices in a ref to avoid re-triggering on Preact re-renders.
 * Each word span must have a `data-wi="<index>"` attribute for DOM selection.
 * New words must start with inline `opacity: 0; filter: blur(4px); transform: translateY(4px)`.
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
			if (words[i]?.isNew && !animatedSet.current.has(i)) {
				animatedSet.current.add(i);
				const el = container.querySelector(`[data-wi="${i}"]`);
				if (el) toAnimate.push(el);
			}
		}

		if (toAnimate.length === 0) return;

		// Blur-fade-rise with spring physics + 30ms micro-stagger between batch words
		for (let i = 0; i < toAnimate.length; i++) {
			animate(
				toAnimate[i]!,
				{ opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
				{ type: spring, stiffness: 380, damping: 22, delay: i * 0.03 },
			);
		}
	});
}
