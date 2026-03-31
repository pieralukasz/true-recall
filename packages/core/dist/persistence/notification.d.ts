/**
 * Notification stub for packages/core.
 * The actual implementation is injected by the platform adapter (Obsidian, desktop, etc.).
 * This file provides no-op defaults so the SQLite layer can compile standalone.
 */
export declare const NOTIFICATION_DURATION: {
    readonly SHORT: 3000;
    readonly NORMAL: 5000;
    readonly LONG: 8000;
    readonly PERSIST: 0;
};
export interface NotificationSink {
    success(message: string, duration?: number): void;
    error(message: string, error?: unknown, duration?: number): void;
    warning(message: string, duration?: number): void;
    info(message: string, duration?: number): void;
}
/** Replace the default no-op notification sink with a real one. */
export declare function setNotificationSink(sink: NotificationSink): void;
/** Get the current notification sink (no-op until `setNotificationSink` is called). */
export declare function notify(): NotificationSink;
