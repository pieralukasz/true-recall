import { State } from "ts-fsrs";
import type { EventBusService } from "../core/event-bus.service";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type {
	CardAddedEvent,
	CardUpdatedEvent,
	CardRemovedEvent,
	CardReviewedEvent,
} from "../../types/events.types";

export interface NoteStatusInfo {
	new: number;
	learning: number;
	dueToday: number;
	total: number;
}

export class NoteStatusCacheService {
	private cache: Map<string, NoteStatusInfo> = new Map();
	private version = 0;
	private unsubscribers: (() => void)[] = [];

	constructor(
		private store: SqliteStoreService,
		private eventBus: EventBusService,
	) {}

	buildFromStore(): void {
		this.cache.clear();
		const cards = this.store.getCardsWithContent();
		const now = new Date();

		for (const card of cards) {
			if (!card.sourceUid) continue;

			let info = this.cache.get(card.sourceUid);
			if (!info) {
				info = { new: 0, learning: 0, dueToday: 0, total: 0 };
				this.cache.set(card.sourceUid, info);
			}

			info.total++;

			if (card.suspended) continue;
			if (card.buriedUntil && new Date(card.buriedUntil) > now) continue;

			switch (card.state) {
				case State.New:
					info.new++;
					break;
				case State.Learning:
				case State.Relearning:
					info.learning++;
					break;
				case State.Review:
					if (new Date(card.due) <= now) {
						info.dueToday++;
					}
					break;
			}
		}
		this.version++;
	}

	registerEvents(): void {
		const granularHandler = (event: { cardId: string }) => {
			this.handleCardEvent(event.cardId);
		};

		this.unsubscribers.push(
			this.eventBus.on<CardAddedEvent>("card:added", granularHandler),
			this.eventBus.on<CardUpdatedEvent>("card:updated", granularHandler),
			this.eventBus.on<CardRemovedEvent>("card:removed", granularHandler),
			this.eventBus.on<CardReviewedEvent>("card:reviewed", granularHandler),
		);

		const bulkHandler = () => {
			this.buildFromStore();
		};

		this.unsubscribers.push(
			this.eventBus.on("cards:bulk-change", bulkHandler),
			this.eventBus.on("store:synced", bulkHandler),
		);
	}

	get(sourceUid: string): NoteStatusInfo | null {
		return this.cache.get(sourceUid) ?? null;
	}

	hasData(): boolean {
		return this.cache.size > 0;
	}

	getVersion(): number {
		return this.version;
	}

	bumpVersion(): void {
		this.version++;
	}

	dispose(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		this.cache.clear();
	}

	private handleCardEvent(cardId: string): void {
		const card = this.store.get(cardId);

		if (!card?.sourceUid) {
			this.buildFromStore();
			return;
		}

		const cards = this.store.getCardsBySourceUid(card.sourceUid);
		const now = new Date();
		const info: NoteStatusInfo = { new: 0, learning: 0, dueToday: 0, total: 0 };

		for (const c of cards) {
			info.total++;

			if (c.suspended) continue;
			if (c.buriedUntil && new Date(c.buriedUntil) > now) continue;

			switch (c.state) {
				case State.New:
					info.new++;
					break;
				case State.Learning:
				case State.Relearning:
					info.learning++;
					break;
				case State.Review:
					if (new Date(c.due) <= now) {
						info.dueToday++;
					}
					break;
			}
		}

		if (info.total === 0) {
			this.cache.delete(card.sourceUid);
		} else {
			this.cache.set(card.sourceUid, info);
		}
		this.version++;
	}
}
