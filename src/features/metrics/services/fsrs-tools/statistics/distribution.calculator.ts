/**
 * Distribution Calculator
 *
 * Calculates distribution statistics for card intervals, stability, and difficulty.
 */

import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import { State } from "ts-fsrs";

/**
 * Histogram bucket
 */
export interface HistogramBucket {
	/** Bucket label (e.g., "0-7", "8-14") */
	label: string;
	/** Lower bound (inclusive) */
	min: number;
	/** Upper bound (exclusive) */
	max: number;
	/** Number of cards in this bucket */
	count: number;
	/** Percentage of total */
	percentage: number;
}

/**
 * Distribution statistics
 */
export interface DistributionStats {
	/** Minimum value */
	min: number;
	/** Maximum value */
	max: number;
	/** Mean value */
	mean: number;
	/** Median value */
	median: number;
	/** Standard deviation */
	stdDev: number;
	/** Total count */
	count: number;
}

/**
 * Distribution Calculator
 *
 * Provides insights into the distribution of card metrics:
 * - Interval distribution (how spread out are review intervals)
 * - Stability distribution (memory strength)
 * - Difficulty distribution (card difficulty ratings)
 */
export class DistributionCalculator {
	constructor(private cardStore: SqliteStoreService) {}

	/**
	 * Get interval distribution histogram
	 */
	getIntervalDistribution(): {
		histogram: HistogramBucket[];
		stats: DistributionStats;
	} {
		const cards = this.cardStore.getCards().filter(
			(c) => !c.suspended && c.state === State.Review, // Review state only
		);

		const intervals = cards.map((c) => c.scheduledDays);

		if (intervals.length === 0) {
			return {
				histogram: [],
				stats: this.emptyStats(),
			};
		}

		// Define buckets for intervals (in days)
		const buckets: [number, number, string][] = [
			[0, 7, "0-7d"],
			[7, 14, "1-2w"],
			[14, 30, "2-4w"],
			[30, 60, "1-2m"],
			[60, 90, "2-3m"],
			[90, 180, "3-6m"],
			[180, 365, "6-12m"],
			[365, Infinity, "1y+"],
		];

		const histogram = this.buildHistogram(intervals, buckets);
		const stats = this.calculateStats(intervals);

		return { histogram, stats };
	}

	/**
	 * Get stability distribution histogram
	 */
	getStabilityDistribution(): {
		histogram: HistogramBucket[];
		stats: DistributionStats;
	} {
		const cards = this.cardStore.getCards().filter(
			(c) => !c.suspended && c.state !== State.New, // Exclude new cards
		);

		const stabilities = cards.map((c) => c.stability);

		if (stabilities.length === 0) {
			return {
				histogram: [],
				stats: this.emptyStats(),
			};
		}

		// Define buckets for stability (in days)
		const buckets: [number, number, string][] = [
			[0, 1, "<1d"],
			[1, 3, "1-3d"],
			[3, 7, "3-7d"],
			[7, 14, "1-2w"],
			[14, 30, "2-4w"],
			[30, 60, "1-2m"],
			[60, 180, "2-6m"],
			[180, Infinity, "6m+"],
		];

		const histogram = this.buildHistogram(stabilities, buckets);
		const stats = this.calculateStats(stabilities);

		return { histogram, stats };
	}

	/**
	 * Get difficulty distribution histogram
	 */
	getDifficultyDistribution(): {
		histogram: HistogramBucket[];
		stats: DistributionStats;
	} {
		const cards = this.cardStore.getCards().filter(
			(c) => !c.suspended && c.state !== State.New, // Exclude new cards
		);

		const difficulties = cards.map((c) => c.difficulty);

		if (difficulties.length === 0) {
			return {
				histogram: [],
				stats: this.emptyStats(),
			};
		}

		// Define buckets for difficulty (1-10 scale)
		const buckets: [number, number, string][] = [
			[1, 2, "1 (Easy)"],
			[2, 3, "2"],
			[3, 4, "3"],
			[4, 5, "4"],
			[5, 6, "5 (Medium)"],
			[6, 7, "6"],
			[7, 8, "7"],
			[8, 9, "8"],
			[9, 10, "9"],
			[10, 11, "10 (Hard)"],
		];

		const histogram = this.buildHistogram(difficulties, buckets);
		const stats = this.calculateStats(difficulties);

		return { histogram, stats };
	}

	/**
	 * Get combined distribution data for charts
	 */
	getAllDistributions(): {
		interval: { histogram: HistogramBucket[]; stats: DistributionStats };
		stability: { histogram: HistogramBucket[]; stats: DistributionStats };
		difficulty: { histogram: HistogramBucket[]; stats: DistributionStats };
	} {
		return {
			interval: this.getIntervalDistribution(),
			stability: this.getStabilityDistribution(),
			difficulty: this.getDifficultyDistribution(),
		};
	}

	/**
	 * Build histogram from values and bucket definitions
	 */
	private buildHistogram(
		values: number[],
		buckets: [number, number, string][],
	): HistogramBucket[] {
		const total = values.length;
		const counts = new Map<string, number>();

		// Initialize counts
		for (const [, , label] of buckets) {
			counts.set(label, 0);
		}

		// Count values in each bucket
		for (const value of values) {
			for (const [min, max, label] of buckets) {
				if (value >= min && value < max) {
					counts.set(label, (counts.get(label) ?? 0) + 1);
					break;
				}
			}
		}

		// Build histogram
		return buckets.map(([min, max, label]) => {
			const count = counts.get(label) ?? 0;
			return {
				label,
				min,
				max,
				count,
				percentage: total > 0 ? (count / total) * 100 : 0,
			};
		});
	}

	/**
	 * Calculate statistics for a set of values
	 */
	private calculateStats(values: number[]): DistributionStats {
		if (values.length === 0) return this.emptyStats();

		const sorted = [...values].sort((a, b) => a - b);
		const n = sorted.length;

		const min = sorted[0] ?? 0;
		const max = sorted[n - 1] ?? 0;
		const sum = sorted.reduce((a, b) => a + b, 0);
		const mean = sum / n;

		// Median
		const median =
			n % 2 === 0
				? ((sorted[n / 2 - 1] ?? 0) + (sorted[n / 2] ?? 0)) / 2
				: (sorted[Math.floor(n / 2)] ?? 0);

		// Standard deviation
		const squaredDiffs = sorted.map((v) => (v - mean) ** 2);
		const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
		const stdDev = Math.sqrt(variance);

		return {
			min,
			max,
			mean: Math.round(mean * 100) / 100,
			median: Math.round(median * 100) / 100,
			stdDev: Math.round(stdDev * 100) / 100,
			count: n,
		};
	}

	/**
	 * Empty statistics object
	 */
	private emptyStats(): DistributionStats {
		return {
			min: 0,
			max: 0,
			mean: 0,
			median: 0,
			stdDev: 0,
			count: 0,
		};
	}
}
