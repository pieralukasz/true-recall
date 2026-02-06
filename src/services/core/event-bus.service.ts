import type {
	FlashcardEventType,
	AnyFlashcardEvent,
	FlashcardEventListener,
} from "../../types/events.types";

export type ListenerErrorCallback = (eventType: FlashcardEventType, error: unknown) => void;

export class EventBusService {
	private listeners: Map<FlashcardEventType, Set<FlashcardEventListener>> =
		new Map();
	private globalListeners: Set<FlashcardEventListener> = new Set();
	private errorCallback: ListenerErrorCallback | null = null;

	/**
	 * Set a callback to be notified when a listener throws an error.
	 * Useful for aggregating errors and debugging state desync issues.
	 */
	setErrorCallback(callback: ListenerErrorCallback | null): void {
		this.errorCallback = callback;
	}

	on<T extends AnyFlashcardEvent>(
		eventType: T["type"],
		listener: FlashcardEventListener<T>
	): () => void {
		if (!this.listeners.has(eventType)) {
			this.listeners.set(eventType, new Set());
		}
		this.listeners.get(eventType)!.add(listener as FlashcardEventListener);

		return () => this.off(eventType, listener);
	}

	onAll(listener: FlashcardEventListener): () => void {
		this.globalListeners.add(listener);
		return () => this.globalListeners.delete(listener);
	}

	off<T extends AnyFlashcardEvent>(
		eventType: T["type"],
		listener: FlashcardEventListener<T>
	): void {
		const listeners = this.listeners.get(eventType);
		if (listeners) {
			listeners.delete(listener as FlashcardEventListener);
		}
	}

	emit(event: AnyFlashcardEvent): void {
		if (!event.timestamp) {
			event.timestamp = Date.now();
		}

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
					this.errorCallback?.(event.type, error);
				}
			});
		}

		this.globalListeners.forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error(`[EventBus] Error in global listener:`, error);
				this.errorCallback?.(event.type, error);
			}
		});
	}

	clear(): void {
		this.listeners.clear();
		this.globalListeners.clear();
	}

	getListenerCount(eventType?: FlashcardEventType): number {
		if (eventType) {
			return this.listeners.get(eventType)?.size ?? 0;
		}
		let total = this.globalListeners.size;
		this.listeners.forEach((set) => (total += set.size));
		return total;
	}
}

let eventBusInstance: EventBusService | null = null;

export function getEventBus(): EventBusService {
	if (!eventBusInstance) {
		eventBusInstance = new EventBusService();
	}
	return eventBusInstance;
}

export function resetEventBus(): void {
	if (eventBusInstance) {
		eventBusInstance.clear();
		eventBusInstance = null;
	}
}
