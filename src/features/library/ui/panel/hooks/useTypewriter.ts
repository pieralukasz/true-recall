import { useEffect, useRef, useState } from "preact/hooks";

// Adapted from llm-ui (https://github.com/richardgill/llm-ui)
// RAF render loop + buffer-based adaptive pacing

const READ_AHEAD = 12;
const TARGET_BUFFER = 20;
const BASE_MS_PER_CHAR = 25;

export function useTypewriter(fullText: string): string {
	const fullTextRef = useRef(fullText);
	const visibleLenRef = useRef(0);
	const frameRef = useRef<number>();
	const lastIncrementTimeRef = useRef(0);
	const renderLoopRef = useRef<(time: DOMHighResTimeStamp) => void>();
	const [visibleLen, setVisibleLen] = useState(0);

	fullTextRef.current = fullText;

	// Reset when target changes incompatibly (new card started)
	const prevTextRef = useRef("");
	if (fullText !== prevTextRef.current) {
		const shown = prevTextRef.current.slice(0, visibleLenRef.current);
		if (shown && !fullText.startsWith(shown)) {
			visibleLenRef.current = 0;
			setVisibleLen(0);
		}
		prevTextRef.current = fullText;
	}

	const reducedMotion = useRef(
		typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);

	// RAF render loop — decoupled from signal updates
	useEffect(() => {
		if (reducedMotion.current) return;

		const renderLoop = (time: DOMHighResTimeStamp) => {
			const full = fullTextRef.current;
			const current = visibleLenRef.current;
			const buffer = full.length - current;

			if (buffer <= 0) {
				frameRef.current = undefined;
				return;
			}

			// Wait for initial buffer before starting display
			if (current === 0 && buffer < READ_AHEAD) {
				frameRef.current = requestAnimationFrame(renderLoop);
				return;
			}

			const timeSinceLast = time - lastIncrementTimeRef.current;

			// Adaptive speed based on buffer size
			const adjustedMs =
				buffer > TARGET_BUFFER + READ_AHEAD
					? BASE_MS_PER_CHAR * 0.7
					: buffer < READ_AHEAD
						? BASE_MS_PER_CHAR * 1.4
						: BASE_MS_PER_CHAR;

			if (timeSinceLast >= adjustedMs) {
				visibleLenRef.current = Math.min(current + 1, full.length);
				setVisibleLen(visibleLenRef.current);
				lastIncrementTimeRef.current = time;
			}

			frameRef.current = requestAnimationFrame(renderLoop);
		};

		renderLoopRef.current = renderLoop;
		lastIncrementTimeRef.current = performance.now();
		frameRef.current = requestAnimationFrame(renderLoop);

		return () => {
			if (frameRef.current) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = undefined;
			}
		};
	}, []);

	// Wake up loop when new text arrives while idle
	useEffect(() => {
		if (
			!reducedMotion.current &&
			!frameRef.current &&
			fullText.length > visibleLenRef.current
		) {
			lastIncrementTimeRef.current = performance.now();
			frameRef.current = requestAnimationFrame(
				(t) => renderLoopRef.current?.(t),
			);
		}
	}, [fullText.length]);

	if (reducedMotion.current) return fullText;
	return fullText.slice(0, visibleLen);
}
