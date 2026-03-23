/**
 * Streak Calculator
 * Calculates current and longest study streaks
 */
import type { ExtendedDailyStats } from "@shared/types";
import { getTodayBoundary } from "@shared/utils";

export interface StreakInfo {
	current: number;
	longest: number;
}

/**
 * Calculator for study streak statistics
 */
export class StreakCalculator {
	/**
	 * Calculate streak information from daily stats
	 */
	calculate(
		allStats: Record<string, ExtendedDailyStats>,
		dayStartHour: number = 4,
	): StreakInfo {
		const reviewDates = Object.keys(allStats)
			.filter((date) => (allStats[date]?.reviewsCompleted ?? 0) > 0)
			.sort((a, b) => b.localeCompare(a)); // Descending

		if (reviewDates.length === 0) {
			return { current: 0, longest: 0 };
		}

		const today = getTodayBoundary(dayStartHour);

		// Calculate current streak
		const currentStreak = this.calculateCurrentStreak(
			reviewDates,
			allStats,
			today,
		);

		// Calculate longest streak
		const longestStreak = this.calculateLongestStreak(reviewDates);

		return {
			current: currentStreak,
			longest: longestStreak,
		};
	}

	private calculateCurrentStreak(
		reviewDates: string[],
		allStats: Record<string, ExtendedDailyStats>,
		today: Date,
	): number {
		const lastStudyDate = reviewDates[0];
		if (!lastStudyDate) return 0;

		const lastStudy = new Date(lastStudyDate);
		const daysSinceLastStudy = Math.floor(
			(today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24),
		);

		// If last study was more than 1 day ago, current streak is 0
		if (daysSinceLastStudy > 1) {
			return 0;
		}

		// Start counting from last study date
		let currentStreak = 0;
		const checkDate = new Date(lastStudyDate);

		// Safety limit: prevent infinite loops (max 3650 days = 10 years)
		const maxIterations = 3650;
		let iterations = 0;

		while (iterations < maxIterations) {
			const checkKey = checkDate.toISOString().split("T")[0] ?? "";
			if (allStats[checkKey] && allStats[checkKey].reviewsCompleted > 0) {
				currentStreak++;
				checkDate.setDate(checkDate.getDate() - 1);
			} else {
				break;
			}
			iterations++;
		}

		return currentStreak;
	}

	private calculateLongestStreak(reviewDates: string[]): number {
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
					(currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
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

		return Math.max(longestStreak, tempStreak);
	}
}
