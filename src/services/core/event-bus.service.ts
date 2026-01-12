/**
 * EventBus Service
 *
 * Central event hub for cross-component communication.
 * Implements a simple pub/sub pattern with strong typing.
 *
 * Usage:
 *   // Subscribe
 *   const unsubscribe = getEventBus().on('card:removed', (event) => {
 *       console.log('Card removed:', event.cardId);
 *   });
 *
 *   // Emit
 *   getEventBus().emit({ type: 'card:removed', cardId: '123', filePath: '...', timestamp: Date.now() });
 *
 *   // Cleanup
 *   unsubscribe();
 */
import type {
	FlashcardEventType,
	AnyFlashcardEvent,
	FlashcardEventListener,
} from "../../types/events.types";

export class EventBusService {
	private listeners: Map<FlashcardEventType, Set<FlashcardEventListener>> =
		new Map();
	private globalListeners: Set<FlashcardEventListener> = new Set();

	/**
	 * Subscribe to a specific event type
	 * @returns Unsubscribe function
	 */
	on<T extends AnyFlashcardEvent>(
		eventType: T["type"],
		listener: FlashcardEventListener<T>
	): () => void {
		if (!this.listeners.has(eventType)) {
			this.listeners.set(eventType, new Set());
		}
		this.listeners.get(eventType)!.add(listener as FlashcardEventListener);

		// Return unsubscribe function
		return () => this.off(eventType, listener);
	}

	/**
	 * Subscribe to ALL events (useful for logging/debugging)
	 * @returns Unsubscribe function
	 */
	onAll(listener: FlashcardEventListener): () => void {
		this.globalListeners.add(listener);
		return () => this.globalListeners.delete(listener);
	}

	/**
	 * Unsubscribe from a specific event type
	 */
	off<T extends AnyFlashcardEvent>(
		eventType: T["type"],
		listener: FlashcardEventListener<T>
	): void {
		const listeners = this.listeners.get(eventType);
		if (listeners) {
			listeners.delete(listener as FlashcardEventListener);
		}
	}

	/**
	 * Emit an event to all subscribers
	 */
	emit(event: AnyFlashcardEvent): void {
		// Add timestamp if not present
		if (!event.timestamp) {
			event.timestamp = Date.now();
		}

		// Notify specific listeners
		const listeners = this.listeners.get(event.type);
		if (listeners) {
			listeners.forEach((listener) => {
				try {
					listener(event);
				} catch (error) {
					console.error(
						`[EventBus] Error in listener for ${event.type}:`,
						error
					);
				}
			});
		}

		// Notify global listeners
		this.globalListeners.forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error(`[EventBus] Error in global listener:`, error);
			}
		});
	}

	/**
	 * Clear all listeners (for cleanup on plugin unload)
	 */
	clear(): void {
		this.listeners.clear();
		this.globalListeners.clear();
	}

	/**
	 * Get listener count for debugging
	 */
	getListenerCount(eventType?: FlashcardEventType): number {
		if (eventType) {
			return this.listeners.get(eventType)?.size ?? 0;
		}
		let total = this.globalListeners.size;
		this.listeners.forEach((set) => (total += set.size));
		return total;
	}
}

// Singleton instance for app-wide access
let eventBusInstance: EventBusService | null = null;

/**
 * Get the singleton EventBus instance
 */
export function getEventBus(): EventBusService {
	if (!eventBusInstance) {
		eventBusInstance = new EventBusService();
	}
	return eventBusInstance;
}

/**
 * Reset the EventBus (call in plugin onunload)
 */
export function resetEventBus(): void {
	if (eventBusInstance) {
		eventBusInstance.clear();
		eventBusInstance = null;
	}
}
