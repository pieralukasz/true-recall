/**
 * Stats Service
 * Provides flashcard statistics with caching to avoid repeated file scans
 */
import type { FlashcardManager } from "../flashcard/flashcard.service";
import type { FSRSService } from "../core/fsrs.service";

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

	private cachedStats: GlobalFlashcardStats | null = null;
	private cacheTimestamp = 0;
	private cacheValidityMs = 30000; // 30 seconds

	constructor(flashcardManager: FlashcardManager, fsrsService: FSRSService) {
		this.flashcardManager = flashcardManager;
		this.fsrsService = fsrsService;
	}

	/**
	 * Get global statistics with caching
	 */
	async getGlobalStats(forceRefresh = false): Promise<GlobalFlashcardStats> {
		const now = Date.now();

		if (
			!forceRefresh &&
			this.cachedStats &&
			now - this.cacheTimestamp < this.cacheValidityMs
		) {
			return this.cachedStats;
		}

		const allCards = await this.flashcardManager.getAllFSRSCards();
		const rawStats = this.fsrsService.getStats(allCards);

		this.cachedStats = {
			total: rawStats.total,
			new: rawStats.new,
			learning: rawStats.learning + rawStats.relearning,
			due: rawStats.dueToday,
		};
		this.cacheTimestamp = now;

		return this.cachedStats;
	}

	/**
	 * Invalidate cache (call after reviews or file changes)
	 */
	invalidateCache(): void {
		this.cachedStats = null;
		this.cacheTimestamp = 0;
	}
}
