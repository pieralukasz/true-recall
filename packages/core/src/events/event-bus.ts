import type { DomainEventMap, DomainEventType } from "./event-types";

type EventHandler<T> = (payload: T) => void;

export class DomainEventBus {
	private handlers = new Map<string, Set<EventHandler<unknown>>>();

	on<K extends DomainEventType>(
		event: K,
		handler: EventHandler<DomainEventMap[K]>,
	): () => void {
		let set = this.handlers.get(event);
		if (!set) {
			set = new Set();
			this.handlers.set(event, set);
		}
		set.add(handler);
		const captured = set;
		return () => {
			captured.delete(handler);
		};
	}

	emit<K extends DomainEventType>(event: K, payload: DomainEventMap[K]): void {
		const set = this.handlers.get(event);
		if (!set) return;
		for (const handler of set) {
			try {
				handler(payload);
			} catch (e) {
				console.error(`[DomainEventBus] Handler error for "${event}":`, e);
			}
		}
	}

	onAny(
		events: DomainEventType[],
		handler: (event: DomainEventType, payload: unknown) => void,
	): () => void {
		const unsubs = events.map((e) => this.on(e, (p: unknown) => handler(e, p)));
		return () => {
			for (const u of unsubs) u();
		};
	}

	dispose(): void {
		this.handlers.clear();
	}
}
