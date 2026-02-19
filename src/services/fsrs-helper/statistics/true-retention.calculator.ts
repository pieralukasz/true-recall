/**
 * True Retention Calculator
 *
 * Calculates actual retention rate based on review history,
 * focusing only on mature cards (Review state) for accuracy.
 */

import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";

/**
 * True retention data point
 */
export interface TrueRetentionEntry {
	/** Date (ISO date string) */
	date: string;
	/** Retention rate (0.0-1.0) */
	retention: number;
	/** Number of reviews on this date */
	reviewCount: number;
}

/**
 * True retention summary
 */
export interface TrueRetentionSummary {
	/** Current retention rate (0.0-1.0) */
	current: number;
	/** Target retention rate from settings */
	target: number;
	/** Trend indicator (-1 = declining, 0 = stable, 1 = improving) */
	trend: -1 | 0 | 1;
	/** Rolling average over the period */
	average: number;
	/** Total reviews analyzed */
	totalReviews: number;
}

/**
 * True Retention Calculator
 *
 * Unlike simple retention (all cards), true retention only counts
 * reviews on mature cards (state = Review, interval >= 21 days).
 * This gives a more accurate picture of long-term memory retention.
 */
export class TrueRetentionCalculator {
	constructor(private cardStore: SqliteStoreService) {}

	/**
	 * Calculate true retention for a date range
	 */
	calculate(startDate: string, endDate: string): TrueRetentionEntry[] {
		// Query review log for mature card reviews
		const reviews = this.cardStore.getReviewsForRetention(startDate, endDate);

		// Group by date
		const byDate = new Map<string, { success: number; total: number }>();

		for (const review of reviews) {
			const dateStr = review.date;
			const existing = byDate.get(dateStr) ?? { success: 0, total: 0 };

			existing.total++;
			if (review.rating >= 3) {
				// Good or Easy = success
				existing.success++;
			}

			byDate.set(dateStr, existing);
		}

		// Convert to entries
		const entries: TrueRetentionEntry[] = [];
		for (const [date, stats] of byDate) {
			entries.push({
				date,
				retention: stats.total > 0 ? stats.success / stats.total : 0,
				reviewCount: stats.total,
			});
		}

		return entries.sort((a, b) => a.date.localeCompare(b.date));
	}

	/**
	 * Get summary statistics
	 */
	getSummary(targetRetention: number, days: number = 30): TrueRetentionSummary {
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const entries = this.calculate(
			this.formatDate(startDate),
			this.formatDate(endDate),
		);

		if (entries.length === 0) {
			return {
				current: 0,
				target: targetRetention,
				trend: 0,
				average: 0,
				totalReviews: 0,
			};
		}

		// Calculate average
		let totalRetention = 0;
		let totalReviews = 0;
		for (const entry of entries) {
			totalRetention += entry.retention * entry.reviewCount;
			totalReviews += entry.reviewCount;
		}
		const average = totalReviews > 0 ? totalRetention / totalReviews : 0;

		// Get current (last 7 days)
		const recentEntries = entries.slice(-7);
		let recentTotal = 0;
		let recentSuccess = 0;
		for (const entry of recentEntries) {
			recentTotal += entry.reviewCount;
			recentSuccess += entry.retention * entry.reviewCount;
		}
		const current = recentTotal > 0 ? recentSuccess / recentTotal : 0;

		// Calculate trend (compare first half vs second half)
		const midpoint = Math.floor(entries.length / 2);
		const firstHalf = entries.slice(0, midpoint);
		const secondHalf = entries.slice(midpoint);

		let firstHalfAvg = 0;
		let firstHalfTotal = 0;
		for (const entry of firstHalf) {
			firstHalfAvg += entry.retention * entry.reviewCount;
			firstHalfTotal += entry.reviewCount;
		}
		firstHalfAvg = firstHalfTotal > 0 ? firstHalfAvg / firstHalfTotal : 0;

		let secondHalfAvg = 0;
		let secondHalfTotal = 0;
		for (const entry of secondHalf) {
			secondHalfAvg += entry.retention * entry.reviewCount;
			secondHalfTotal += entry.reviewCount;
		}
		secondHalfAvg = secondHalfTotal > 0 ? secondHalfAvg / secondHalfTotal : 0;

		let trend: -1 | 0 | 1 = 0;
		const diff = secondHalfAvg - firstHalfAvg;
		if (diff > 0.02) trend = 1; // Improving
		if (diff < -0.02) trend = -1; // Declining

		return {
			current,
			target: targetRetention,
			trend,
			average,
			totalReviews,
		};
	}

	/**
	 * Get rolling average retention
	 */
	getRollingAverage(
		days: number = 30,
		window: number = 7,
	): TrueRetentionEntry[] {
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days - window);

		const entries = this.calculate(
			this.formatDate(startDate),
			this.formatDate(endDate),
		);

		if (entries.length < window) return entries;

		// Calculate rolling average
		const result: TrueRetentionEntry[] = [];
		for (let i = window - 1; i < entries.length; i++) {
			const windowEntries = entries.slice(i - window + 1, i + 1);

			let totalRetention = 0;
			let totalReviews = 0;
			for (const entry of windowEntries) {
				totalRetention += entry.retention * entry.reviewCount;
				totalReviews += entry.reviewCount;
			}

			result.push({
				date: entries[i]?.date,
				retention: totalReviews > 0 ? totalRetention / totalReviews : 0,
				reviewCount: totalReviews,
			});
		}

		return result;
	}

	/**
	 * Format date as YYYY-MM-DD
	 */
	private formatDate(date: Date): string {
		return date.toISOString().split("T")[0] ?? "";
	}
}
