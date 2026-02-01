/**
 * Stats Calculator Service
 * Facade for statistics calculations - delegates to specialized calculators
 *
 * Architecture:
 * - StreakCalculator: Current and longest study streaks
 * - MaturityCalculator: Card maturity breakdown, cards by category
 * - ChartDataCalculator: Future due, cards created, retention history
 */
import { State } from "ts-fsrs";
import type { FSRSService } from "../core/fsrs.service";
import type { FlashcardManager } from "../flashcard/flashcard.service";
import type { SessionPersistenceService } from "../persistence/session-persistence.service";
import type { SqliteStoreService } from "../persistence/sqlite";
import type {
	CardMaturityBreakdown,
	FutureDueEntry,
	CardsCreatedEntry,
	CardsCreatedVsReviewedEntry,
	ExtendedDailyStats,
	TodaySummary,
	StatsTimeRange,
	FSRSFlashcardItem,
	RetentionEntry,
} from "../../types";
import { StreakCalculator, MaturityCalculator, ChartDataCalculator, type StreakInfo } from "./calculators";

/**
 * Service for calculating statistics for the statistics panel
 * Acts as a facade delegating to specialized calculators
 */
export class StatsCalculatorService {
	private sessionPersistence: SessionPersistenceService;
	private sqliteStore: SqliteStoreService | null = null;

	// Specialized calculators
	private streakCalculator = new StreakCalculator();
	private maturityCalculator = new MaturityCalculator();
	private chartDataCalculator = new ChartDataCalculator();

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
		this.maturityCalculator.setSqliteStore(store);
		this.chartDataCalculator.setSqliteStore(store);
	}

	/**
	 * Get all daily stats for calendar heatmap (lightweight - no card IDs)
	 * Exposes sessionPersistence.getAllDailyStatsSummary() without revealing internal dependency
	 */
	getAllDailyStats(): Record<string, ExtendedDailyStats> {
		if (!this.sessionPersistence) {
			return {};
		}
		return this.sessionPersistence.getAllDailyStatsSummary();
	}

	/**
	 * Get card maturity breakdown for pie chart
	 * Young: Review cards with interval < 21 days
	 * Mature: Review cards with interval >= 21 days
	 */
	async getCardMaturityBreakdown(): Promise<CardMaturityBreakdown> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		return this.maturityCalculator.calculate(allCards);
	}

	/**
	 * Get future due predictions for bar chart
	 * @param range Time range: 'backlog' | '1m' | '3m' | '1y' | 'all'
	 */
	async getFutureDueStats(range: StatsTimeRange): Promise<FutureDueEntry[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		return this.chartDataCalculator.getFutureDueStats(allCards, range);
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
		if (!this.sessionPersistence) {
			return { current: 0, longest: 0 };
		}
		const allStats = await this.sessionPersistence.getAllDailyStatsSummary();
		return this.streakCalculator.calculate(allStats);
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
		if (!this.sessionPersistence) {
			return [];
		}
		const allStats = await this.sessionPersistence.getAllDailyStatsSummary();
		return this.chartDataCalculator.getRetentionHistory(allStats, range);
	}

	// ===== Private helpers =====

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
		return this.chartDataCalculator.getFutureDueStatsFilled(allCards, range);
	}

	/**
	 * Get cards due on a specific date
	 * @param date ISO date string (YYYY-MM-DD)
	 */
	async getCardsDueOnDate(date: string): Promise<FSRSFlashcardItem[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		return this.chartDataCalculator.getCardsDueOnDate(allCards, date);
	}

	/**
	 * Get cards by maturity category
	 * @param category Category key from CardMaturityBreakdown
	 */
	async getCardsByCategory(
		category: keyof CardMaturityBreakdown
	): Promise<FSRSFlashcardItem[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		return this.maturityCalculator.getCardsByCategory(allCards, category);
	}

	/**
	 * Get cards created history with filled-in missing days
	 * Returns one entry per day for the entire range
	 * Note: "backlog" range is skipped as it's for future predictions, not creation history
	 */
	async getCardsCreatedHistoryFilled(
		range: StatsTimeRange
	): Promise<CardsCreatedEntry[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		return this.chartDataCalculator.getCardsCreatedHistoryFilled(allCards, range);
	}

	/**
	 * Get cards created on a specific date
	 * @param date ISO date string (YYYY-MM-DD)
	 */
	async getCardsCreatedOnDate(date: string): Promise<FSRSFlashcardItem[]> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		return this.chartDataCalculator.getCardsCreatedOnDate(allCards, date);
	}

	/**
	 * Get cards created vs reviewed history for comparison chart
	 * Shows for each day: created count, reviewed count, and same-day reviewed count
	 * @param range Time range for the chart
	 */
	async getCardsCreatedVsReviewedHistory(
		range: StatsTimeRange
	): Promise<CardsCreatedVsReviewedEntry[]> {
		return this.chartDataCalculator.getCardsCreatedVsReviewedHistory(range);
	}
}
