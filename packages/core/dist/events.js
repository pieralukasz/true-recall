/**
 * Simple event emitter for card change notifications.
 * Platform-agnostic replacement for @preact/signals-based notifyCardChange.
 */
const listeners = [];
export function notifyCardChange(mutation) {
    for (const listener of listeners) {
        try {
            listener(mutation);
        }
        catch (e) {
            console.error("[core/events] Card change listener error:", e);
        }
    }
}
export function onCardChange(listener) {
    listeners.push(listener);
    return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0)
            listeners.splice(idx, 1);
    };
}
