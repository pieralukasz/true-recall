import { useCallback, useEffect, useRef } from "preact/hooks";
const DEFAULT_DELAY = 500;
export function useLongPress({ onLongPress, delay = DEFAULT_DELAY, }) {
    const ref = useRef({
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
    const onPointerDown = useCallback((e) => {
        if (e.button !== 0)
            return;
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
