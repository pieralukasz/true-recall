import { useEffect, useRef, useState } from "preact/hooks";

// Fraction of remaining gap revealed per frame (exponential smoothing).
// At 60fps: burst of 50 chars catches up in ~250ms with natural deceleration.
const SMOOTHING = 0.12;

export function useStreamingText(fullText: string): {
	visibleText: string;
	isTyping: boolean;
} {
	const [visibleLen, setVisibleLen] = useState(0);
	const visibleRef = useRef(0);
	const frameRef = useRef<number>();
	const fullTextRef = useRef(fullText);

	fullTextRef.current = fullText;

	// Reset when text changes incompatibly (new card started)
	const prevTextRef = useRef("");
	if (fullText !== prevTextRef.current) {
		const shown = prevTextRef.current.slice(0, visibleRef.current);
		if (shown && !fullText.startsWith(shown)) {
			visibleRef.current = 0;
			setVisibleLen(0);
		}
		prevTextRef.current = fullText;
	}

	const reducedMotion = useRef(
		typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);

	useEffect(() => {
		if (reducedMotion.current) return;

		const loop = () => {
			const target = fullTextRef.current.length;
			const current = visibleRef.current;
			const gap = target - current;

			if (gap > 0) {
				const advance = Math.max(1, Math.round(gap * SMOOTHING));
				visibleRef.current = Math.min(current + advance, target);
				setVisibleLen(visibleRef.current);
			}

			frameRef.current = requestAnimationFrame(loop);
		};

		frameRef.current = requestAnimationFrame(loop);
		return () => {
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
		};
	}, []);

	if (reducedMotion.current) return { visibleText: fullText, isTyping: false };
	return {
		visibleText: fullText.slice(0, visibleLen),
		isTyping: visibleLen < fullText.length,
	};
}
