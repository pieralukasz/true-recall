/**
 * Session Persistence Service
 * Handles persistent storage of daily review statistics in .episteme/stats.json
 */
import { App, TFile, normalizePath } from "obsidian";
import { State, Rating } from "ts-fsrs";
import type { PersistentStatsData, PersistentDailyStats, ExtendedDailyStats, Grade } from "../types";

const STATS_FOLDER = ".episteme";
const STATS_FILE = "stats.json";
const CURRENT_VERSION = 2;

/**
 * Service for persisting review session data across plugin restarts
 * Stores data in vault for sync compatibility with mobile
 */
export class SessionPersistenceService {
	private app: App;
	private statsPath: string;
	private cache: PersistentStatsData | null = null;

	constructor(app: App) {
		this.app = app;
		this.statsPath = normalizePath(`${STATS_FOLDER}/${STATS_FILE}`);
	}

	/**
	 * Get today's date in YYYY-MM-DD format
	 */
	getTodayKey(): string {
		return new Date().toISOString().split("T")[0] ?? "";
	}

	/**
	 * Load stats from file (with caching and migration)
	 */
	async loadStats(): Promise<PersistentStatsData> {
		if (this.cache) {
			return this.cache;
		}

		try {
			const file = this.app.vault.getAbstractFileByPath(this.statsPath);
			let rawStats: PersistentStatsData | null = null;

			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				rawStats = JSON.parse(content) as PersistentStatsData;
			} else {
				// Try to read via adapter (file might exist but not indexed yet)
				const exists = await this.app.vault.adapter.exists(
					this.statsPath
				);
				if (exists) {
					const content = await this.app.vault.adapter.read(
						this.statsPath
					);
					rawStats = JSON.parse(content) as PersistentStatsData;
				}
			}

			if (rawStats) {
				// Migrate if needed
				if (rawStats.version < CURRENT_VERSION) {
					rawStats = this.migrateStats(rawStats);
					await this.saveStats(rawStats);
				}
				this.cache = rawStats;
				return this.cache;
			}
		} catch {
			// Error loading stats, will create default
		}

		// Cache default stats so subsequent calls work correctly
		this.cache = this.createDefaultStats();
		return this.cache;
	}

	/**
	 * Migrate stats from older versions
	 */
	private migrateStats(stats: PersistentStatsData): PersistentStatsData {
		// V1 -> V2: Add extended daily stats fields
		if (stats.version === 1) {
			const migratedDaily: Record<string, PersistentDailyStats> = {};
			for (const [date, dayStats] of Object.entries(stats.daily) as [string, PersistentDailyStats][]) {
				migratedDaily[date] = {
					...dayStats,
					// Add new fields with defaults (we don't have historical data)
					again: 0,
					hard: 0,
					good: 0,
					easy: 0,
					newCards: 0,
					learningCards: 0,
					reviewCards: 0,
				} as ExtendedDailyStats;
			}
			stats.daily = migratedDaily;
			stats.version = 2;
		}
		return stats;
	}

	/**
	 * Save stats to file
	 */
	async saveStats(stats: PersistentStatsData): Promise<void> {
		stats.lastUpdated = new Date().toISOString();
		this.cache = stats;

		try {
			await this.ensureFolderExists();

			const content = JSON.stringify(stats, null, 2);
			const file = this.app.vault.getAbstractFileByPath(this.statsPath);

			if (file instanceof TFile) {
				await this.app.vault.modify(file, content);
			} else {
				try {
					await this.app.vault.create(this.statsPath, content);
				} catch (createError) {
					// File exists on disk but not in Obsidian's index yet
					if (
						createError instanceof Error &&
						createError.message.includes("already exists")
					) {
						await this.app.vault.adapter.write(
							this.statsPath,
							content
						);
					} else {
						throw createError;
					}
				}
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get today's stats (creates empty if not exists)
	 */
	async getTodayStats(): Promise<PersistentDailyStats> {
		const stats = await this.loadStats();
		const today = this.getTodayKey();

		if (!stats.daily[today]) {
			stats.daily[today] = this.createEmptyDayStats(today);
		}

		return stats.daily[today]!;
	}

	/**
	 * Record a card review with extended stats
	 */
	async recordReview(
		cardId: string,
		isNewCard: boolean,
		durationMs: number,
		rating?: Grade,
		previousState?: State
	): Promise<void> {
		const stats = await this.loadStats();
		const today = this.getTodayKey();

		if (!stats.daily[today]) {
			stats.daily[today] = this.createEmptyDayStats(today);
		}

		const dayStats = stats.daily[today] as ExtendedDailyStats;

		// Add card ID if not already reviewed
		if (!dayStats.reviewedCardIds.includes(cardId)) {
			dayStats.reviewedCardIds.push(cardId);
		}

		dayStats.reviewsCompleted++;
		dayStats.totalTimeMs += durationMs;

		if (isNewCard) {
			dayStats.newCardsStudied++;
		}

		// Track rating breakdown (for statistics panel)
		if (rating !== undefined) {
			if (rating === Rating.Again) dayStats.again++;
			else if (rating === Rating.Hard) dayStats.hard++;
			else if (rating === Rating.Good) dayStats.good++;
			else if (rating === Rating.Easy) dayStats.easy++;
		}

		// Track card type breakdown (for statistics panel)
		if (previousState !== undefined) {
			if (previousState === State.New) {
				dayStats.newCards++;
			} else if (previousState === State.Learning || previousState === State.Relearning) {
				dayStats.learningCards++;
			} else if (previousState === State.Review) {
				dayStats.reviewCards++;
			}
		}

		await this.saveStats(stats);
	}

	/**
	 * Get set of cards reviewed today (for queue exclusion)
	 */
	async getReviewedToday(): Promise<Set<string>> {
		const dayStats = await this.getTodayStats();
		return new Set(dayStats.reviewedCardIds);
	}

	/**
	 * Get count of new cards studied today
	 */
	async getNewCardsStudiedToday(): Promise<number> {
		const dayStats = await this.getTodayStats();
		return dayStats.newCardsStudied;
	}

	/**
	 * Remove the last review (for undo functionality)
	 */
	async removeLastReview(cardId: string, wasNewCard: boolean): Promise<void> {
		const stats = await this.loadStats();
		const today = this.getTodayKey();

		if (!stats.daily[today]) {
			return; // Nothing to undo
		}

		const dayStats = stats.daily[today]!;

		// Decrement counters
		dayStats.reviewsCompleted = Math.max(0, dayStats.reviewsCompleted - 1);

		if (wasNewCard) {
			dayStats.newCardsStudied = Math.max(
				0,
				dayStats.newCardsStudied - 1
			);
		}

		// Note: We don't remove cardId from reviewedCardIds because:
		// 1. The card might have been reviewed multiple times
		// 2. The undo is just for the rating, not for "unlearning" the card

		await this.saveStats(stats);
	}

	/**
	 * Get all daily stats (for statistics panel - calendar, history charts)
	 * Note: No longer doing cleanup - we keep all historical data for stats
	 */
	async getAllDailyStats(): Promise<Record<string, ExtendedDailyStats>> {
		const stats = await this.loadStats();
		return stats.daily as Record<string, ExtendedDailyStats>;
	}

	/**
	 * Get stats in a date range
	 * @param startDate Start date in YYYY-MM-DD format
	 * @param endDate End date in YYYY-MM-DD format
	 */
	async getStatsInRange(startDate: string, endDate: string): Promise<ExtendedDailyStats[]> {
		const stats = await this.loadStats();
		const result: ExtendedDailyStats[] = [];

		for (const [date, dayStats] of Object.entries(stats.daily)) {
			if (date >= startDate && date <= endDate) {
				result.push(dayStats as ExtendedDailyStats);
			}
		}

		// Sort by date ascending
		return result.sort((a, b) => a.date.localeCompare(b.date));
	}

	/**
	 * Clean up old stats (keep last 30 days)
	 * @deprecated No longer called automatically - stats are kept for statistics panel
	 */
	async cleanupOldStats(): Promise<void> {
		// Deprecated: We no longer clean up stats to preserve historical data
		// for the statistics panel. This method is kept for backwards compatibility.
	}

	/**
	 * Invalidate cache (call after external changes)
	 */
	invalidateCache(): void {
		this.cache = null;
	}

	// ===== Private helpers =====

	private createDefaultStats(): PersistentStatsData {
		return {
			version: CURRENT_VERSION,
			lastUpdated: new Date().toISOString(),
			daily: {},
		};
	}

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

	private async ensureFolderExists(): Promise<void> {
		const folderPath = normalizePath(STATS_FOLDER);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!folder) {
			try {
				await this.app.vault.createFolder(folderPath);
			} catch (error) {
				// Ignore "folder already exists" error (race condition)
				if (
					!(
						error instanceof Error &&
						error.message.includes("already exists")
					)
				) {
					throw error;
				}
			}
		}
	}
}
