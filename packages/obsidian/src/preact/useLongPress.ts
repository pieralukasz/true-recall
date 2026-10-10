import { useCallback, useEffect, useRef } from "preact/hooks";

interface UseLongPressOptions {
	onLongPress: () => void;
	delay?: number;
}

interface UseLongPressResult {
	handlers: {
		onPointerDown: (e: PointerEvent) => void;
		onPointerUp: () => void;
		onPointerCancel: () => void;
	};
	wasLongPress: () => boolean;
}

const DEFAULT_DELAY = 500;
/** Moving further than this cancels the press: it is a drag or a scroll, not a long press. */
const MOVE_TOLERANCE_PX = 8;

interface PressState {
	timer: number | null;
	wasLongPress: boolean;
	stopTracking: (() => void) | null;
}

export function useLongPress({
	onLongPress,
	delay = DEFAULT_DELAY,
}: UseLongPressOptions): UseLongPressResult {
	const ref = useRef<PressState>({
		timer: null,
		wasLongPress: false,
		stopTracking: null,
	});

	const cancel = useCallback(() => {
		const lp = ref.current;
		if (lp.timer) {
			window.clearTimeout(lp.timer);
			lp.timer = null;
		}
		lp.stopTracking?.();
	}, []);

	useEffect(() => cancel, [cancel]);

	const onPointerDown = useCallback(
		(e: PointerEvent) => {
			if (e.button !== 0) return;
			cancel();
			const lp = ref.current;
			lp.wasLongPress = false;
			const startX = e.clientX;
			const startY = e.clientY;
			// Track on the document: a drag leaves the pressed row before the delay ends.
			const doc =
				(e.currentTarget as Node | null)?.ownerDocument ?? activeDocument;
			const onMove = (move: PointerEvent) => {
				if (
					Math.abs(move.clientX - startX) > MOVE_TOLERANCE_PX ||
					Math.abs(move.clientY - startY) > MOVE_TOLERANCE_PX
				)
					cancel();
			};
			doc.addEventListener("pointermove", onMove, true);
			lp.stopTracking = () => {
				doc.removeEventListener("pointermove", onMove, true);
				lp.stopTracking = null;
			};
			lp.timer = window.setTimeout(() => {
				lp.wasLongPress = true;
				lp.timer = null;
				lp.stopTracking?.();
				onLongPress();
			}, delay);
		},
		[onLongPress, delay, cancel],
	);

	return {
		handlers: {
			onPointerDown,
			onPointerUp: cancel,
			onPointerCancel: cancel,
		},
		wasLongPress: () => ref.current.wasLongPress,
	};
}
