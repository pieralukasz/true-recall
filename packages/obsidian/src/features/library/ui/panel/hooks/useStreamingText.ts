import { useEffect, useRef, useState } from "preact/hooks";

// Adaptive smoothing: faster catch-up when far behind, deliberate pace when close
const SMOOTHING_BASE = 0.1;
const SMOOTHING_FAST = 0.18;

// How long a word stays in "new" state (triggers pop-in CSS animation)
const NEW_WORD_DURATION_MS = 200;

// Punctuation that creates micro-pauses for organic typing feel
const PAUSE_CHARS = /[.!?;:,]/;

export interface StreamingWord {
	text: string;
	isNew: boolean;
}

export function useStreamingText(fullText: string): {
	words: StreamingWord[];
	isTyping: boolean;
} {
	const [, triggerRender] = useState(0);
	const visibleRef = useRef(0);
	const frameRef = useRef<number>();
	const wordsRef = useRef<string[]>([]);
	const newTimestampsRef = useRef<Map<number, number>>(new Map());

	// Memoization refs — only rebuild word array when these change
	const cachedWordsRef = useRef<StreamingWord[]>([]);
	const lastVisibleRef = useRef(0);
	const lastNewCountRef = useRef(0);

	const allWords = splitWords(fullText);
	wordsRef.current = allWords;

	// Reset when text changes incompatibly (new card started)
	const prevTextRef = useRef("");
	if (fullText !== prevTextRef.current) {
		const prevWords = splitWords(prevTextRef.current);
		const shownText = prevWords.slice(0, visibleRef.current).join("");
		if (shownText && !fullText.startsWith(shownText)) {
			visibleRef.current = 0;
			newTimestampsRef.current.clear();
			cachedWordsRef.current = [];
			lastVisibleRef.current = 0;
			lastNewCountRef.current = 0;
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
			let needsRender = false;

			if (gap > 0) {
				// Adaptive smoothing: faster when far behind, slower when close
				const smoothing = gap > 5 ? SMOOTHING_FAST : SMOOTHING_BASE;
				let advance = Math.max(1, Math.round(gap * smoothing));

				// Micro-pause at punctuation for organic typing feel
				const prevWord = wordsRef.current[current - 1];
				if (prevWord && PAUSE_CHARS.test(prevWord.trimEnd().slice(-1))) {
					advance = Math.min(advance, 1);
				}

				const newCount = Math.min(current + advance, targetCount);

				for (let i = current; i < newCount; i++) {
					if (!newTimestampsRef.current.has(i)) {
						newTimestampsRef.current.set(i, now);
					}
				}

				visibleRef.current = newCount;
				needsRender = true;
			}

			// Sweep expired "new" timestamps
			for (const [idx, timestamp] of newTimestampsRef.current) {
				if (now - timestamp > NEW_WORD_DURATION_MS) {
					newTimestampsRef.current.delete(idx);
					needsRender = true;
				}
			}

			// Single render trigger for all changes in this frame
			if (needsRender) {
				triggerRender((n) => n + 1);
			}

			frameRef.current = window.requestAnimationFrame(loop);
		};

		frameRef.current = window.requestAnimationFrame(loop);
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

	// Memoized word array — only rebuild when visible count or isNew set changes
	const currentVisible = visibleRef.current;
	const currentNewCount = newTimestampsRef.current.size;

	if (
		currentVisible !== lastVisibleRef.current ||
		currentNewCount !== lastNewCountRef.current
	) {
		const now = Date.now();
		cachedWordsRef.current = allWords
			.slice(0, currentVisible)
			.map((text, i) => ({
				text,
				isNew:
					newTimestampsRef.current.has(i) &&
					now - (newTimestampsRef.current.get(i) ?? 0) < NEW_WORD_DURATION_MS,
			}));
		lastVisibleRef.current = currentVisible;
		lastNewCountRef.current = currentNewCount;
	}

	return {
		words: cachedWordsRef.current,
		isTyping: currentVisible < allWords.length,
	};
}

function splitWords(text: string): string[] {
	if (!text) return [];
	const matches = text.match(/\S+\s*/g);
	return matches ?? [];
}
