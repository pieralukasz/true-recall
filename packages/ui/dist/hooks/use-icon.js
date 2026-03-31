import { useEffect, useRef } from "preact/hooks";
import { useTrueRecall } from "../context";
/**
 * Platform-agnostic icon hook.
 * Delegates to the render.icon() function provided by the host.
 */
export function useIcon(iconId) {
    const { render } = useTrueRecall();
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current instanceof HTMLElement && iconId) {
            render.icon(ref.current, iconId);
        }
    }, [iconId, render]);
    return ref;
}
