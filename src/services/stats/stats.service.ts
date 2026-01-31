/**
 * Stats Service
 * Provides flashcard statistics with auto-invalidating cache
 */
import type { FlashcardManager } from "../flashcard/flashcard.service";
import type { FSRSService } from "../core/fsrs.service";
import type { EventBusService } from "../core/event-bus.service";
import { ReactiveCache } from "../cache";

/**
 * Global flashcard statistics
 */
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
			invalidateOn: eventBus
				? ["card:added", "card:removed", "card:updated", "card:reviewed", "cards:bulk-change"]
				: [],
			ttlMs: 30000, // 30 seconds fallback TTL
			eventBus: eventBus ?? createNoOpEventBus(),
			label: "StatsService",
		});
	}

	/**
	 * Compute stats from all cards
	 */
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

	/**
	 * Get global statistics with caching
	 */
	async getGlobalStats(forceRefresh = false): Promise<GlobalFlashcardStats> {
		return this.statsCache.get(forceRefresh);
	}

	/**
	 * Invalidate cache (manual trigger - usually not needed with reactive cache)
	 */
	invalidateCache(): void {
		this.statsCache.invalidate();
	}

	/**
	 * Dispose the service and cleanup subscriptions
	 */
	dispose(): void {
		this.statsCache.dispose();
	}
}

/**
 * Create a no-op EventBus for backwards compatibility when eventBus is not provided
 */
function createNoOpEventBus(): EventBusService {
	return {
		on: () => () => {},
		off: () => {},
		emit: () => {},
		onAll: () => () => {},
		clear: () => {},
		getListenerCount: () => 0,
	} as unknown as EventBusService;
}
