import { useCallback, useEffect, useRef } from "preact/hooks";

export interface UseLongPressOptions {
	onLongPress: () => void;
	delay?: number;
}

export interface UseLongPressResult {
	handlers: {
		onPointerDown: () => void;
		onPointerUp: () => void;
		onPointerCancel: () => void;
	};
	wasLongPress: () => boolean;
}

const DEFAULT_DELAY = 500;

export function useLongPress({
	onLongPress,
	delay = DEFAULT_DELAY,
}: UseLongPressOptions): UseLongPressResult {
	const ref = useRef<{
		timer: ReturnType<typeof setTimeout> | null;
		wasLongPress: boolean;
	}>({
		timer: null,
		wasLongPress: false,
	});

	useEffect(() => {
		return () => {
			if (ref.current.timer) {
				clearTimeout(ref.current.timer);
			}
		};
	}, []);

	const onPointerDown = useCallback(() => {
		const lp = ref.current;
		lp.wasLongPress = false;
		lp.timer = setTimeout(() => {
			lp.wasLongPress = true;
			lp.timer = null;
			onLongPress();
		}, delay);
	}, [onLongPress, delay]);

	const onPointerUp = useCallback(() => {
		const lp = ref.current;
		if (lp.timer) {
			clearTimeout(lp.timer);
			lp.timer = null;
		}
	}, []);

	return {
		handlers: {
			onPointerDown,
			onPointerUp,
			onPointerCancel: onPointerUp,
		},
		wasLongPress: () => ref.current.wasLongPress,
	};
}
