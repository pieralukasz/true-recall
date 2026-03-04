import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import { effect } from "@preact/signals";
import { type NoteStatusInfo, cards } from "@shared/services/reactive-card-store";
import { type CardMutation, lastMutation } from "@shared/services/signals";
import { State } from "ts-fsrs";

export type { NoteStatusInfo } from "@shared/services/reactive-card-store";

export class NoteStatusCacheService {
	private cache: Map<string, NoteStatusInfo> = new Map();
	private version = 0;
	private disposers: (() => void)[] = [];

	constructor(private store: SqliteStoreService) {}

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
		this.disposers.push(
			effect(() => {
				const m = lastMutation.value;
				if (!m) return;
				this.handleMutation(m);
			}),
			effect(() => {
				cards.value;
				this.buildFromStore();
			}),
		);
	}

	private handleMutation(m: CardMutation): void {
		if (m.type === "bulk") {
			this.buildFromStore();
		} else if (m.cardId) {
			this.handleCardEvent(m.cardId);
		}
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
		for (const dispose of this.disposers) {
			dispose();
		}
		this.disposers = [];
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
