import { useEffect, useRef, useState } from "preact/hooks";

// Fraction of remaining word gap revealed per frame (exponential smoothing).
// Coarser than character-level: 0.12 at 60fps catches up in ~250ms.
const SMOOTHING = 0.12;

// How long a word stays in "new" state (triggers blur+fade CSS animation)
const NEW_WORD_DURATION_MS = 300;

export interface StreamingWord {
	text: string;
	isNew: boolean;
}

export function useStreamingText(fullText: string): {
	words: StreamingWord[];
	isTyping: boolean;
} {
	const [visibleCount, setVisibleCount] = useState(0);
	const visibleRef = useRef(0);
	const frameRef = useRef<number>();
	const fullTextRef = useRef(fullText);
	const wordsRef = useRef<string[]>([]);
	const newTimestampsRef = useRef<Map<number, number>>(new Map());
	const [, forceRender] = useState(0);

	// Split text into words (each word includes its trailing whitespace)
	const allWords = splitWords(fullText);
	wordsRef.current = allWords;
	fullTextRef.current = fullText;

	// Reset when text changes incompatibly (new card started)
	const prevTextRef = useRef("");
	if (fullText !== prevTextRef.current) {
		const prevWords = splitWords(prevTextRef.current);
		const shownWords = prevWords.slice(0, visibleRef.current);
		const shownText = shownWords.join("");
		if (shownText && !fullText.startsWith(shownText)) {
			visibleRef.current = 0;
			setVisibleCount(0);
			newTimestampsRef.current.clear();
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
			const targetCount = wordsRef.current.length;
			const current = visibleRef.current;
			const gap = targetCount - current;
			const now = Date.now();

			if (gap > 0) {
				const advance = Math.max(1, Math.round(gap * SMOOTHING));
				const newCount = Math.min(current + advance, targetCount);

				// Record timestamps for newly visible words
				for (let i = current; i < newCount; i++) {
					if (!newTimestampsRef.current.has(i)) {
						newTimestampsRef.current.set(i, now);
					}
				}

				visibleRef.current = newCount;
				setVisibleCount(newCount);
			}

			// Sweep expired "new" timestamps and trigger re-render to remove isNew
			let expired = false;
			for (const [idx, timestamp] of newTimestampsRef.current) {
				if (now - timestamp > NEW_WORD_DURATION_MS) {
					newTimestampsRef.current.delete(idx);
					expired = true;
				}
			}
			if (expired) {
				forceRender((n) => n + 1);
			}

			frameRef.current = requestAnimationFrame(loop);
		};

		frameRef.current = requestAnimationFrame(loop);
		return () => {
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
		};
	}, []);

	if (reducedMotion.current) {
		return {
			words: allWords.map((text) => ({ text, isNew: false })),
			isTyping: false,
		};
	}

	const now = Date.now();
	const visible = allWords.slice(0, visibleCount).map((text, i) => ({
		text,
		isNew:
			newTimestampsRef.current.has(i) &&
			now - (newTimestampsRef.current.get(i) ?? 0) < NEW_WORD_DURATION_MS,
	}));

	return {
		words: visible,
		isTyping: visibleCount < allWords.length,
	};
}

function splitWords(text: string): string[] {
	if (!text) return [];
	const matches = text.match(/\S+\s*/g);
	return matches ?? [];
}
