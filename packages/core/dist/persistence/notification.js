/**
 * Notification stub for packages/core.
 * The actual implementation is injected by the platform adapter (Obsidian, desktop, etc.).
 * This file provides no-op defaults so the SQLite layer can compile standalone.
 */
export const NOTIFICATION_DURATION = {
    SHORT: 3000,
    NORMAL: 5000,
    LONG: 8000,
    PERSIST: 0,
};
const noopSink = {
    success(_message, _duration) {
        /* no-op */
    },
    error(message, error, _duration) {
        if (error) {
            console.error(`[True Recall] ${message}:`, error);
        }
    },
    warning(_message, _duration) {
        /* no-op */
    },
    info(_message, _duration) {
        /* no-op */
    },
};
let currentSink = noopSink;
/** Replace the default no-op notification sink with a real one. */
export function setNotificationSink(sink) {
    currentSink = sink;
}
/** Get the current notification sink (no-op until `setNotificationSink` is called). */
export function notify() {
    return currentSink;
}
