/**
 * Platform adapter for user notifications.
 * Obsidian: wraps new Notice()
 * Desktop: wraps system notifications or toast UI
 */
export interface INotification {
	show(message: string, timeout?: number): void;
	error(message: string): void;
}
