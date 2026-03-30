/**
 * Platform-agnostic context menu hook.
 *
 * Components call useContextMenu(items) and get back a click handler.
 * The actual menu display is delegated to the host platform via
 * the TrueRecallContext. For now, we provide a simple fallback that
 * calls the first matching action — the Obsidian adapter will override
 * this with the native Menu API.
 */
import { useCallback, useRef } from "preact/hooks";
/**
 * Context menu hook.
 *
 * In the Obsidian adapter, this will be replaced with the real
 * Obsidian Menu. For the UI package, we export the type-safe interface
 * so components can declare their menu items.
 *
 * The onContextMenu parameter is an optional platform-specific handler.
 * If not provided, this is a no-op (context menu display is up to the host).
 */
export function useContextMenu(items, onShow) {
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const onShowRef = useRef(onShow);
    onShowRef.current = onShow;
    return useCallback((e) => {
        e.stopPropagation();
        if (onShowRef.current) {
            onShowRef.current(itemsRef.current, e);
        }
    }, []);
}
