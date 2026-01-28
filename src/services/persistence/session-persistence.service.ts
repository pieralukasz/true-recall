/**
 * Session Persistence Service
 * Handles persistent storage of daily review statistics in SQL (daily_stats table)
 */
import { App, normalizePath } from "obsidian";
import { State, Rating } from "ts-fsrs";
import type { PersistentStatsData, ExtendedDailyStats, Grade } from "../../types";
import type { SqliteStoreService } from "./sqlite";
import type { DayBoundaryService } from "../core/day-boundary.service";

const STATS_FOLDER = ".true-recall";
const STATS_FILE = "stats.json";

/**
 * Service for persisting review session data across plugin restarts
 * Uses SQLite for storage (daily_stats and daily_reviewed_cards tables)
 */
export class SessionPersistenceService {
	private app: App;
	private store: SqliteStoreService;
	private dayBoundaryService: DayBoundaryService;

	constructor(app: App, store: SqliteStoreService, dayBoundaryService: DayBoundaryService) {
		this.app = app;
		this.store = store;
		this.dayBoundaryService = dayBoundaryService;
	}

	/**
	 * Get today's date in YYYY-MM-DD format (respects dayStartHour)
	 * At 3 AM with dayStartHour=4, returns yesterday's date
	 */
	getTodayKey(): string {
		return this.dayBoundaryService.getTodayKey();
	}

	/**
	 * Get today's stats (creates empty if not exists)
	 */
	getTodayStats(): ExtendedDailyStats {
		const today = this.getTodayKey();
		const stats = this.store.stats.getDailyStats(today);

		if (stats) {
			return stats;
		}

		return this.createEmptyDayStats(today);
	}

	/**
	 * Record a card review with extended stats
	 */
	recordReview(
		cardId: string,
		isNewCard: boolean,
		durationMs: number,
		rating?: Grade,
		previousState?: State,
		scheduledDays?: number,
		elapsedDays?: number
	): void {
		const today = this.getTodayKey();

		// Record the reviewed card (for daily limit tracking)
		this.store.stats.recordReviewedCard(today, cardId);

		// Build stats increment
		const statsIncrement: Partial<ExtendedDailyStats> = {
			reviewsCompleted: 1,
			totalTimeMs: durationMs,
			newCardsStudied: isNewCard ? 1 : 0,
			// Rating breakdown
			again: rating === Rating.Again ? 1 : 0,
			hard: rating === Rating.Hard ? 1 : 0,
			good: rating === Rating.Good ? 1 : 0,
			easy: rating === Rating.Easy ? 1 : 0,
			// Card type breakdown
			newCards: previousState === State.New ? 1 : 0,
			learningCards: (previousState === State.Learning || previousState === State.Relearning) ? 1 : 0,
			reviewCards: previousState === State.Review ? 1 : 0,
		};

		this.store.stats.updateDailyStats(today, statsIncrement);

		// Record to review_log for detailed history
		if (rating !== undefined) {
			this.store.stats.addReviewLog(
				cardId,
				rating,
				scheduledDays ?? 0,
				elapsedDays ?? 0,
				previousState ?? 0,
				durationMs
			);
		}
	}

	/**
	 * Get set of cards reviewed today (for queue exclusion)
	 */
	getReviewedToday(): Set<string> {
		const today = this.getTodayKey();
		const cardIds = this.store.stats.getReviewedCardIds(today);
		return new Set(cardIds);
	}

	/**
	 * Get count of new cards studied today
	 */
	getNewCardsStudiedToday(): number {
		const today = this.getTodayKey();
		const stats = this.store.stats.getDailyStats(today);
		return stats?.newCardsStudied ?? 0;
	}

	/**
	 * Remove the last review (for undo functionality)
	 */
	removeLastReview(
		cardId: string,
		wasNewCard: boolean,
		rating?: Grade,
		previousState?: State
	): void {
		const today = this.getTodayKey();

		// Build stats decrement
		const statsDecrement: Partial<ExtendedDailyStats> = {
			reviewsCompleted: 1,
			newCardsStudied: wasNewCard ? 1 : 0,
			// Rating breakdown
			again: rating === Rating.Again ? 1 : 0,
			hard: rating === Rating.Hard ? 1 : 0,
			good: rating === Rating.Good ? 1 : 0,
			easy: rating === Rating.Easy ? 1 : 0,
			// Card type breakdown
			newCards: previousState === State.New ? 1 : 0,
			learningCards: (previousState === State.Learning || previousState === State.Relearning) ? 1 : 0,
			reviewCards: previousState === State.Review ? 1 : 0,
		};

		this.store.stats.decrementDailyStats(today, statsDecrement);

		// Note: We don't remove cardId from daily_reviewed_cards because:
		// 1. The card might have been reviewed multiple times
		// 2. The undo is just for the rating, not for "unlearning" the card
	}

	/**
	 * Get all daily stats (includes card IDs - use for migrations/specific card lookups)
	 */
	getAllDailyStats(): Record<string, ExtendedDailyStats> {
		return this.store.stats.getAllDailyStats();
	}

	/**
	 * Get all daily stats summary (lightweight - no card IDs)
	 * Use this for charts and heatmaps where individual card IDs aren't needed.
	 */
	getAllDailyStatsSummary(): Record<string, ExtendedDailyStats> {
		return this.store.stats.getAllDailyStatsSummary();
	}

	/**
	 * Get stats in a date range
	 * @param startDate Start date in YYYY-MM-DD format
	 * @param endDate End date in YYYY-MM-DD format
	 */
	getStatsInRange(startDate: string, endDate: string): ExtendedDailyStats[] {
		const allStats = this.store.stats.getAllDailyStatsSummary();
		const result: ExtendedDailyStats[] = [];

		for (const [date, dayStats] of Object.entries(allStats)) {
			if (date >= startDate && date <= endDate) {
				result.push(dayStats);
			}
		}

		// Sort by date ascending
		return result.sort((a, b) => a.date.localeCompare(b.date));
	}

	/**
	 * Invalidate cache (no-op for SQL, kept for API compatibility)
	 */
	invalidateCache(): void {
		// No-op: SQLite doesn't use a separate cache layer
	}

	/**
	 * Migrate stats from JSON file to SQL (one-time migration)
	 * Call this during plugin initialization after SQL store is ready
	 */
	async migrateStatsJsonToSql(): Promise<void> {
		const statsPath = normalizePath(`${STATS_FOLDER}/${STATS_FILE}`);

		try {
			const exists = await this.app.vault.adapter.exists(statsPath);
			if (!exists) {
				return; // No JSON file to migrate
			}

			console.log("[Episteme] Migrating stats.json to SQL...");

			const content = await this.app.vault.adapter.read(statsPath);
			const data = JSON.parse(content) as PersistentStatsData;

			let migratedDays = 0;
			let migratedCards = 0;

			for (const [date, dayStats] of Object.entries(data.daily)) {
				const extendedStats = dayStats as ExtendedDailyStats;

				// Migrate stats (use updateDailyStats which does UPSERT)
				this.store.stats.updateDailyStats(date, {
					reviewsCompleted: extendedStats.reviewsCompleted || 0,
					newCardsStudied: extendedStats.newCardsStudied || 0,
					totalTimeMs: extendedStats.totalTimeMs || 0,
					again: extendedStats.again || 0,
					hard: extendedStats.hard || 0,
					good: extendedStats.good || 0,
					easy: extendedStats.easy || 0,
					newCards: extendedStats.newCards || 0,
					learningCards: extendedStats.learningCards || 0,
					reviewCards: extendedStats.reviewCards || 0,
				});
				migratedDays++;

				// Migrate reviewed card IDs
				for (const cardId of extendedStats.reviewedCardIds || []) {
					this.store.stats.recordReviewedCard(date, cardId);
					migratedCards++;
				}
			}

			// Flush to ensure data is persisted
			await this.store.saveNow();

			// Delete the old JSON file
			await this.app.vault.adapter.remove(statsPath);

			console.log(
				`[Episteme] Migrated stats.json to SQL: ${migratedDays} days, ${migratedCards} card entries. JSON file removed.`
			);
		} catch (error) {
			console.error("[Episteme] Failed to migrate stats.json:", error);
			// Don't throw - migration failure shouldn't block plugin startup
		}
	}

	// ===== Private helpers =====

	private createEmptyDayStats(date: string): ExtendedDailyStats {
		return {
			date,
			reviewedCardIds: [],
			newCardsStudied: 0,
			reviewsCompleted: 0,
			totalTimeMs: 0,
			// Extended fields for statistics panel
			again: 0,
			hard: 0,
			good: 0,
			easy: 0,
			newCards: 0,
			learningCards: 0,
			reviewCards: 0,
		};
	}
}
