import type {
	FlashcardEventType,
	AnyFlashcardEvent,
	FlashcardEventListener,
} from "../../types/events.types";

export class EventBusService {
	private listeners: Map<FlashcardEventType, Set<FlashcardEventListener>> =
		new Map();
	private globalListeners: Set<FlashcardEventListener> = new Set();

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
