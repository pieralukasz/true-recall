/**
 * Stats Calculator Service
 * Calculates statistics for the statistics panel (charts, summaries, etc.)
 */
import { State } from "ts-fsrs";
import type { FSRSService } from "../core/fsrs.service";
import type { FlashcardManager } from "../flashcard/flashcard.service";
import type { SessionPersistenceService } from "../persistence/session-persistence.service";
import type { SqliteStoreService } from "../persistence/sqlite-store.service";
import type {
	CardMaturityBreakdown,
	FutureDueEntry,
	ExtendedDailyStats,
	TodaySummary,
	StreakInfo,
	StatsTimeRange,
	FSRSFlashcardItem,
	RetentionEntry,
} from "../../types";

/**
 * Service for calculating statistics for the statistics panel
 */
export class StatsCalculatorService {
	private sessionPersistence: SessionPersistenceService;
	private sqliteStore: SqliteStoreService | null = null;

	constructor(
		private fsrsService: FSRSService,
		private flashcardManager: FlashcardManager,
		sessionPersistence: SessionPersistenceService
	) {
		this.sessionPersistence = sessionPersistence;
	}

	/**
	 * Set SQLite store for optimized queries
	 * When set, uses SQL aggregations instead of iterating all cards
	 */
	setSqliteStore(store: SqliteStoreService): void {
		this.sqliteStore = store;
	}

	/**
	 * Get all daily stats for calendar heatmap
	 * Exposes sessionPersistence.getAllDailyStats() without revealing internal dependency
	 */
	async getAllDailyStats(): Promise<Record<string, ExtendedDailyStats>> {
		return this.sessionPersistence.getAllDailyStats() as Promise<
			Record<string, ExtendedDailyStats>
		>;
	}

	/**
	 * Get card maturity breakdown for pie chart
	 * Young: Review cards with interval < 21 days
	 * Mature: Review cards with interval >= 21 days
	 */
	async getCardMaturityBreakdown(): Promise<CardMaturityBreakdown> {
		// Use optimized SQLite query when available
		if (this.sqliteStore) {
			return this.sqliteStore.getCardMaturityBreakdown();
		}

		// Fallback to iterating all cards
		const allCards = await this.flashcardManager.getAllFSRSCards();
		const now = new Date();

		// Helper to check if card is active (not suspended and not currently buried)
		const isActive = (c: FSRSFlashcardItem) => {
			if (c.fsrs.suspended) return false;
			if (c.fsrs.buriedUntil && new Date(c.fsrs.buriedUntil) > now) return false;
			return true;
		};

		// Helper to check if card is currently buried
		const isBuried = (c: FSRSFlashcardItem) => {
			if (c.fsrs.suspended) return false; // Suspended takes precedence
			return c.fsrs.buriedUntil && new Date(c.fsrs.buriedUntil) > now;
		};

		return {
			new: allCards.filter(
				(c) => isActive(c) && c.fsrs.state === State.New
			).length,
			learning: allCards.filter(
				(c) =>
					isActive(c) &&
					(c.fsrs.state === State.Learning ||
						c.fsrs.state === State.Relearning)
			).length,
			young: allCards.filter(
				(c) =>
					isActive(c) &&
					c.fsrs.state === State.Review &&
					c.fsrs.scheduledDays < 21
			).length,
			mature: allCards.filter(
				(c) =>
					isActive(c) &&
					c.fsrs.state === State.Review &&
					c.fsrs.scheduledDays >= 21
			).length,
			suspended: allCards.filter((c) => c.fsrs.suspended).length,
			buried: allCards.filter((c) => isBuried(c)).length,
		};
	}

	/**
	 * Get future due predictions for bar chart
	 * @param range Time range: 'backlog' | '1m' | '3m' | '1y' | 'all'
	 */
	async getFutureDueStats(range: StatsTimeRange): Promise<FutureDueEntry[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Calculate end date based on range
		const endDate = this.calculateEndDate(today, range);

		// Group cards by due date
		const dueMap = new Map<string, number>();

		for (const card of allCards) {
			// Skip new cards (they're not "due" in the traditional sense)
			if (card.fsrs.state === State.New) continue;

			const dueDate = new Date(card.fsrs.due);
			dueDate.setHours(0, 0, 0, 0);

			// For 'backlog', only include past due cards
			if (range === "backlog" && dueDate >= today) continue;

			// For other ranges, include up to end date
			if (range !== "backlog" && dueDate > endDate) continue;

			// Use local date formatting to avoid timezone issues
			const dateKey = this.formatLocalDate(dueDate);
			dueMap.set(dateKey, (dueMap.get(dateKey) ?? 0) + 1);
		}

		// Convert to sorted array
		const entries = Array.from(dueMap.entries())
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date));

		// Calculate cumulative
		let cumulative = 0;
		return entries.map((entry) => {
			cumulative += entry.count;
			return {
				date: entry.date,
				count: entry.count,
				cumulative,
			};
		});
	}

	/**
	 * Get historical review data for reviews chart
	 * @param range Time range: '1m' | '3m' | '1y' | 'all'
	 */
	async getReviewHistory(
		range: StatsTimeRange
	): Promise<ExtendedDailyStats[]> {
		const endDate = new Date();
		const startDate = this.calculateStartDate(endDate, range);

		const startKey = startDate.toISOString().split("T")[0] ?? "";
		const endKey = endDate.toISOString().split("T")[0] ?? "";

		return this.sessionPersistence.getStatsInRange(startKey, endKey);
	}

	/**
	 * Get today's summary statistics
	 */
	async getTodaySummary(): Promise<TodaySummary> {
		const todayStats =
			(await this.sessionPersistence.getTodayStats()) as ExtendedDailyStats;

		const totalRatings =
			(todayStats.again ?? 0) +
			(todayStats.hard ?? 0) +
			(todayStats.good ?? 0) +
			(todayStats.easy ?? 0);
		const correctReviews = (todayStats.good ?? 0) + (todayStats.easy ?? 0);

		return {
			studied: todayStats.reviewsCompleted,
			minutes: Math.round(todayStats.totalTimeMs / 60000),
			newCards: todayStats.newCardsStudied,
			reviewCards: todayStats.reviewCards ?? 0,
			again: todayStats.again ?? 0,
			correctRate: totalRatings > 0 ? correctReviews / totalRatings : 0,
		};
	}

	/**
	 * Get streak information
	 */
	async getStreakInfo(): Promise<StreakInfo> {
		const allStats = await this.sessionPersistence.getAllDailyStats();

		// Get dates with reviews, sorted descending
		const reviewDates = Object.keys(allStats)
			.filter((date) => allStats[date]!.reviewsCompleted > 0)
			.sort((a, b) => b.localeCompare(a)); // Descending

		if (reviewDates.length === 0) {
			return { current: 0, longest: 0 };
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todayKey = today.toISOString().split("T")[0] ?? "";

		// Calculate current streak
		let currentStreak = 0;
		let checkDate = new Date(today);

		// Check if studied today or yesterday
		const lastStudyDate = reviewDates[0];
		if (!lastStudyDate) return { current: 0, longest: 0 };
		const lastStudy = new Date(lastStudyDate);
		const daysSinceLastStudy = Math.floor(
			(today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24)
		);

		// If last study was more than 1 day ago, current streak is 0
		if (daysSinceLastStudy > 1) {
			currentStreak = 0;
		} else {
			// Start counting from last study date
			checkDate = new Date(lastStudyDate);
			// Safety limit: prevent infinite loops (max 3650 days = 10 years)
			const maxIterations = 3650;
			let iterations = 0;
			while (iterations < maxIterations) {
				const checkKey = checkDate.toISOString().split("T")[0] ?? "";
				if (
					allStats[checkKey] &&
					allStats[checkKey].reviewsCompleted > 0
				) {
					currentStreak++;
					checkDate.setDate(checkDate.getDate() - 1);
				} else {
					break;
				}
				iterations++;
			}
		}

		// Calculate longest streak
		let longestStreak = 0;
		let tempStreak = 0;
		let prevDate: Date | null = null;

		for (const dateStr of [...reviewDates].sort()) {
			const currentDate = new Date(dateStr);
			currentDate.setHours(0, 0, 0, 0);

			if (prevDate === null) {
				tempStreak = 1;
			} else {
				const dayDiff = Math.floor(
					(currentDate.getTime() - prevDate.getTime()) /
						(1000 * 60 * 60 * 24)
				);
				if (dayDiff === 1) {
					tempStreak++;
				} else {
					longestStreak = Math.max(longestStreak, tempStreak);
					tempStreak = 1;
				}
			}
			prevDate = currentDate;
		}
		longestStreak = Math.max(longestStreak, tempStreak);

		return {
			current: currentStreak,
			longest: longestStreak,
		};
	}

	/**
	 * Get summary statistics for a time range
	 */
	async getRangeSummary(range: StatsTimeRange): Promise<{
		daysStudied: number;
		totalDays: number;
		totalReviews: number;
		avgPerDay: number;
		avgForStudiedDays: number;
		dueTomorrow: number;
		dailyLoad: number;
	}> {
		const history = await this.getReviewHistory(range);
		const allCards = await this.flashcardManager.getAllFSRSCards();

		const endDate = new Date();
		const startDate = this.calculateStartDate(endDate, range);
		const totalDays = Math.ceil(
			(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
		);

		const daysStudied = history.filter(
			(d) => d.reviewsCompleted > 0
		).length;
		const totalReviews = history.reduce(
			(sum, d) => sum + d.reviewsCompleted,
			0
		);

		// Calculate due tomorrow
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);
		const tomorrowEnd = new Date(tomorrow);
		tomorrowEnd.setHours(23, 59, 59, 999);

		const dueTomorrow = allCards.filter((c) => {
			if (c.fsrs.state === State.New) return false;
			const dueDate = new Date(c.fsrs.due);
			return dueDate >= tomorrow && dueDate <= tomorrowEnd;
		}).length;

		// Calculate daily load (average cards due per day in next 30 days)
		const futureStats = await this.getFutureDueStats("1m");
		const dailyLoad =
			futureStats.length > 0
				? Math.round(
						futureStats.reduce((sum, d) => sum + d.count, 0) /
							Math.max(futureStats.length, 1)
				  )
				: 0;

		return {
			daysStudied,
			totalDays,
			totalReviews,
			avgPerDay: totalDays > 0 ? Math.round(totalReviews / totalDays) : 0,
			avgForStudiedDays:
				daysStudied > 0 ? Math.round(totalReviews / daysStudied) : 0,
			dueTomorrow,
			dailyLoad,
		};
	}

	/**
	 * Get retention rate history for line chart
	 * Retention = (Good + Easy) / Total reviews
	 */
	async getRetentionHistory(range: StatsTimeRange): Promise<RetentionEntry[]> {
		const allStats = await this.sessionPersistence.getAllDailyStats();
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const startDate = this.calculateStartDate(today, range);

		// Helper for local date formatting
		const formatLocalDate = (d: Date): string => {
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			return `${year}-${month}-${day}`;
		};

		const startDateStr = formatLocalDate(startDate);
		const todayStr = formatLocalDate(today);

		const entries: RetentionEntry[] = [];

		for (const [date, stats] of Object.entries(allStats)) {
			// Filter by date range
			if (date < startDateStr || date > todayStr) continue;

			// Calculate total reviews with rating breakdown
			const again = (stats as ExtendedDailyStats).again ?? 0;
			const hard = (stats as ExtendedDailyStats).hard ?? 0;
			const good = (stats as ExtendedDailyStats).good ?? 0;
			const easy = (stats as ExtendedDailyStats).easy ?? 0;

			const total = again + hard + good + easy;
			if (total === 0) continue;

			// Retention = correct answers (good + easy) / total
			const correct = good + easy;
			const retention = Math.round((correct / total) * 100);

			entries.push({ date, retention, total });
		}

		return entries.sort((a, b) => a.date.localeCompare(b.date));
	}

	// ===== Private helpers =====

	/**
	 * Format date as local YYYY-MM-DD string
	 * Uses local calendar date (not UTC) to avoid timezone issues
	 */
	private formatLocalDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	private calculateEndDate(today: Date, range: StatsTimeRange): Date {
		const endDate = new Date(today);

		switch (range) {
			case "backlog":
				// Backlog shows past, end at yesterday
				endDate.setDate(endDate.getDate() - 1);
				break;
			case "1m":
				endDate.setMonth(endDate.getMonth() + 1);
				break;
			case "3m":
				endDate.setMonth(endDate.getMonth() + 3);
				break;
			case "1y":
				endDate.setFullYear(endDate.getFullYear() + 1);
				break;
			case "all":
				endDate.setFullYear(endDate.getFullYear() + 10);
				break;
		}

		return endDate;
	}

	private calculateStartDate(today: Date, range: StatsTimeRange): Date {
		const startDate = new Date(today);

		switch (range) {
			case "backlog":
				// For backlog, show last year
				startDate.setFullYear(startDate.getFullYear() - 1);
				break;
			case "1m":
				startDate.setMonth(startDate.getMonth() - 1);
				break;
			case "3m":
				startDate.setMonth(startDate.getMonth() - 3);
				break;
			case "1y":
				startDate.setFullYear(startDate.getFullYear() - 1);
				break;
			case "all":
				startDate.setFullYear(startDate.getFullYear() - 10);
				break;
		}

		return startDate;
	}

	/**
	 * Get future due stats with filled-in missing days
	 * Returns one entry per day for the entire range (30, 90, 365 days)
	 */
	async getFutureDueStatsFilled(
		range: StatsTimeRange
	): Promise<FutureDueEntry[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const endDate = this.calculateEndDate(today, range);

		// For backlog, return the existing sparse data
		if (range === "backlog") {
			return this.getFutureDueStats(range);
		}

		// Helper to format date as local YYYY-MM-DD (not UTC)
		// toISOString() converts to UTC which shifts dates in UTC+X timezones
		const formatLocalDate = (d: Date): string => {
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			return `${year}-${month}-${day}`;
		};

		// Generate all days in range
		const dueMap = new Map<string, number>();
		const currentDate = new Date(today);

		while (currentDate <= endDate) {
			const dateKey = formatLocalDate(currentDate);
			dueMap.set(dateKey, 0);
			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Count cards for each day
		for (const card of allCards) {
			if (card.fsrs.state === State.New || card.fsrs.suspended) continue;

			const dueDate = new Date(card.fsrs.due);
			dueDate.setHours(0, 0, 0, 0);
			const dateKey = formatLocalDate(dueDate);

			if (dueMap.has(dateKey)) {
				const currentCount = dueMap.get(dateKey) ?? 0;
				dueMap.set(dateKey, currentCount + 1);
			}
		}

		// Convert to sorted array with cumulative
		const entries = Array.from(dueMap.entries())
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date));

		let cumulative = 0;
		return entries.map((entry) => {
			cumulative += entry.count;
			return {
				date: entry.date,
				count: entry.count,
				cumulative,
			};
		});
	}

	/**
	 * Get cards due on a specific date
	 * @param date ISO date string (YYYY-MM-DD)
	 */
	async getCardsDueOnDate(date: string): Promise<FSRSFlashcardItem[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();

		// Parse date as local (not UTC) - date format is "YYYY-MM-DD"
		// Using new Date("YYYY-MM-DD") parses as UTC which causes off-by-one errors
		const parts = date.split("-").map(Number);
		const [year, month, day] = parts;
		if (year === undefined || month === undefined || day === undefined) {
			throw new Error(`Invalid date format: ${date}`);
		}
		const targetDate = new Date(year, month - 1, day); // month is 0-indexed
		targetDate.setHours(0, 0, 0, 0);

		return allCards.filter((card) => {
			if (card.fsrs.state === State.New || card.fsrs.suspended) return false;

			const dueDate = new Date(card.fsrs.due);
			dueDate.setHours(0, 0, 0, 0);

			// Use toDateString() for robust local date comparison
			// This avoids timezone issues with getTime() comparison
			return dueDate.toDateString() === targetDate.toDateString();
		});
	}

	/**
	 * Get cards by maturity category
	 * @param category Category key from CardMaturityBreakdown
	 */
	async getCardsByCategory(
		category: keyof CardMaturityBreakdown
	): Promise<FSRSFlashcardItem[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		const now = new Date();

		// Helper to check if card is active (not suspended and not currently buried)
		const isActive = (c: FSRSFlashcardItem) => {
			if (c.fsrs.suspended) return false;
			if (c.fsrs.buriedUntil && new Date(c.fsrs.buriedUntil) > now) return false;
			return true;
		};

		// Helper to check if card is currently buried
		const isBuried = (c: FSRSFlashcardItem) => {
			if (c.fsrs.suspended) return false; // Suspended takes precedence
			return c.fsrs.buriedUntil && new Date(c.fsrs.buriedUntil) > now;
		};

		switch (category) {
			case "new":
				return allCards.filter(
					(c) => isActive(c) && c.fsrs.state === State.New
				);
			case "learning":
				return allCards.filter(
					(c) =>
						isActive(c) &&
						(c.fsrs.state === State.Learning ||
							c.fsrs.state === State.Relearning)
				);
			case "young":
				return allCards.filter(
					(c) =>
						isActive(c) &&
						c.fsrs.state === State.Review &&
						c.fsrs.scheduledDays < 21
				);
			case "mature":
				return allCards.filter(
					(c) =>
						isActive(c) &&
						c.fsrs.state === State.Review &&
						c.fsrs.scheduledDays >= 21
				);
			case "suspended":
				return allCards.filter((c) => c.fsrs.suspended);
			case "buried":
				return allCards.filter((c) => isBuried(c));
			default:
				return [];
		}
	}
}
