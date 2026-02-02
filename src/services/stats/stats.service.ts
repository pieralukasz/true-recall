import type { FlashcardManager } from "../flashcard/flashcard.service";
import type { FSRSService } from "../core/fsrs.service";
import type { EventBusService } from "../core/event-bus.service";
import { ReactiveCache } from "../cache";

export interface GlobalFlashcardStats {
	total: number;
	new: number;
	learning: number;
	due: number;
}

export class StatsService {
	private flashcardManager: FlashcardManager;
	private fsrsService: FSRSService;
	private statsCache: ReactiveCache<GlobalFlashcardStats>;

	constructor(
		flashcardManager: FlashcardManager,
		fsrsService: FSRSService,
		eventBus?: EventBusService
	) {
		this.flashcardManager = flashcardManager;
		this.fsrsService = fsrsService;

		// Initialize reactive cache with auto-invalidation on card events
		// If no eventBus provided, cache only uses TTL-based expiration
		this.statsCache = new ReactiveCache({
			compute: () => this.computeStats(),
			invalidateOn: ["card:added", "card:removed", "card:updated", "card:reviewed", "cards:bulk-change"],
			ttlMs: 30000, // 30 seconds fallback TTL
			eventBus, // undefined is now valid - ReactiveCache handles it
			label: "StatsService",
		});
	}

	private async computeStats(): Promise<GlobalFlashcardStats> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		const rawStats = this.fsrsService.getStats(allCards);

		return {
			total: rawStats.total,
			new: rawStats.new,
			learning: rawStats.learning + rawStats.relearning,
			due: rawStats.dueToday,
		};
	}

	async getGlobalStats(forceRefresh = false): Promise<GlobalFlashcardStats> {
		return this.statsCache.get(forceRefresh);
	}

	invalidateCache(): void {
		this.statsCache.invalidate();
	}

	dispose(): void {
		this.statsCache.dispose();
	}
}
