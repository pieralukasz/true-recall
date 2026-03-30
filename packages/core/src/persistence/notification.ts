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
} as const;

export interface NotificationSink {
	success(message: string, duration?: number): void;
	error(message: string, error?: unknown, duration?: number): void;
	warning(message: string, duration?: number): void;
	info(message: string, duration?: number): void;
}

const noopSink: NotificationSink = {
	success(_message: string, _duration?: number): void {
		/* no-op */
	},
	error(message: string, error?: unknown, _duration?: number): void {
		if (error) {
			console.error(`[True Recall] ${message}:`, error);
		}
	},
	warning(_message: string, _duration?: number): void {
		/* no-op */
	},
	info(_message: string, _duration?: number): void {
		/* no-op */
	},
};

let currentSink: NotificationSink = noopSink;

/** Replace the default no-op notification sink with a real one. */
export function setNotificationSink(sink: NotificationSink): void {
	currentSink = sink;
}

/** Get the current notification sink (no-op until `setNotificationSink` is called). */
export function notify(): NotificationSink {
	return currentSink;
}
