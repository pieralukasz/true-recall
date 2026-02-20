import { ReactiveCache } from "../../../../features/core/cache";
import type { FSRSService } from "../../../../features/core/services/fsrs.service";
import { dataVersion } from "../../../../shared/services/signals";
import type { FlashcardManager } from "../../../../features/study/services/flashcard/flashcard.service";

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

	constructor(flashcardManager: FlashcardManager, fsrsService: FSRSService) {
		this.flashcardManager = flashcardManager;
		this.fsrsService = fsrsService;

		this.statsCache = new ReactiveCache({
			compute: () => this.computeStats(),
			invalidateOn: [dataVersion],
			ttlMs: 30000,
			label: "StatsService",
		});
	}

	private computeStats(): Promise<GlobalFlashcardStats> {
		const allCards = this.flashcardManager.getAllFSRSCards();
		const rawStats = this.fsrsService.getStats(allCards);

		return Promise.resolve({
			total: rawStats.total,
			new: rawStats.new,
			learning: rawStats.learning + rawStats.relearning,
			due: rawStats.dueToday,
		});
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
