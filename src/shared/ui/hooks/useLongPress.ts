import { useCallback, useRef } from "preact/hooks";

const LONG_PRESS_DURATION = 500;

export interface LongPressHandlers {
	onPointerDown: () => void;
	onPointerUp: () => void;
	onPointerLeave: () => void;
	onPointerCancel: () => void;
	wasLongPress: () => boolean;
}

/**
 * Preact hook for long-press detection on touch/pointer interactions.
 * Returns pointer event handlers and a `wasLongPress()` check for click handlers.
 */
export function useLongPress(
	callback: () => void,
	duration = LONG_PRESS_DURATION,
): LongPressHandlers {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const longPressRef = useRef(false);

	const clear = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const onPointerDown = useCallback(() => {
		longPressRef.current = false;
		timerRef.current = setTimeout(() => {
			longPressRef.current = true;
			callback();
			timerRef.current = null;
		}, duration);
	}, [callback, duration]);

	const onPointerUp = clear;
	const onPointerLeave = clear;
	const onPointerCancel = clear;

	const wasLongPress = useCallback(() => longPressRef.current, []);

	return { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel, wasLongPress };
}
