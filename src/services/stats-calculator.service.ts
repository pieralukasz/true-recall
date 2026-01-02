/**
 * Stats Calculator Service
 * Calculates statistics for the statistics panel (charts, summaries, etc.)
 */
import { State } from "ts-fsrs";
import type { FSRSService } from "./fsrs.service";
import type { FlashcardManager } from "./flashcard.service";
import type { SessionPersistenceService } from "./session-persistence.service";
import type {
	CardMaturityBreakdown,
	FutureDueEntry,
	ExtendedDailyStats,
	TodaySummary,
	StreakInfo,
	StatsTimeRange,
} from "../types";

/**
 * Service for calculating statistics for the statistics panel
 */
export class StatsCalculatorService {
	// Public to allow StatsView to access for calendar
	public sessionPersistence: SessionPersistenceService;

	constructor(
		private fsrsService: FSRSService,
		private flashcardManager: FlashcardManager,
		sessionPersistence: SessionPersistenceService
	) {
		this.sessionPersistence = sessionPersistence;
	}

	/**
	 * Get card maturity breakdown for pie chart
	 * Young: Review cards with interval < 21 days
	 * Mature: Review cards with interval >= 21 days
	 */
	async getCardMaturityBreakdown(): Promise<CardMaturityBreakdown> {
		const allCards = await this.flashcardManager.getAllFSRSCards();

		return {
			new: allCards.filter((c) => !c.fsrs.suspended && c.fsrs.state === State.New).length,
			learning: allCards.filter(
				(c) =>
					!c.fsrs.suspended &&
					(c.fsrs.state === State.Learning || c.fsrs.state === State.Relearning)
			).length,
			young: allCards.filter(
				(c) =>
					!c.fsrs.suspended &&
					c.fsrs.state === State.Review &&
					c.fsrs.scheduledDays < 21
			).length,
			mature: allCards.filter(
				(c) =>
					!c.fsrs.suspended &&
					c.fsrs.state === State.Review &&
					c.fsrs.scheduledDays >= 21
			).length,
			suspended: allCards.filter((c) => c.fsrs.suspended).length,
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

			const dateKey = dueDate.toISOString().split("T")[0]!;
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
	async getReviewHistory(range: StatsTimeRange): Promise<ExtendedDailyStats[]> {
		const endDate = new Date();
		const startDate = this.calculateStartDate(endDate, range);

		const startKey = startDate.toISOString().split("T")[0]!;
		const endKey = endDate.toISOString().split("T")[0]!;

		return this.sessionPersistence.getStatsInRange(startKey, endKey);
	}

	/**
	 * Get today's summary statistics
	 */
	async getTodaySummary(): Promise<TodaySummary> {
		const todayStats = await this.sessionPersistence.getTodayStats() as ExtendedDailyStats;

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
		const todayKey = today.toISOString().split("T")[0]!;

		// Calculate current streak
		let currentStreak = 0;
		let checkDate = new Date(today);

		// Check if studied today or yesterday
		const lastStudyDate = reviewDates[0]!;
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
			while (true) {
				const checkKey = checkDate.toISOString().split("T")[0]!;
				if (allStats[checkKey] && allStats[checkKey]!.reviewsCompleted > 0) {
					currentStreak++;
					checkDate.setDate(checkDate.getDate() - 1);
				} else {
					break;
				}
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
					(currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
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

		const daysStudied = history.filter((d) => d.reviewsCompleted > 0).length;
		const totalReviews = history.reduce((sum, d) => sum + d.reviewsCompleted, 0);

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

	// ===== Private helpers =====

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
}
