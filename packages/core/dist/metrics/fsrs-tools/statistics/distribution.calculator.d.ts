/**
 * Distribution Calculator
 *
 * Calculates distribution statistics for card intervals, stability, and difficulty.
 */
import type { SqliteStoreService } from "../../../persistence/sqlite/SqliteStoreService";
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
export declare class DistributionCalculator {
    private cardStore;
    constructor(cardStore: SqliteStoreService);
    /**
     * Get interval distribution histogram
     */
    getIntervalDistribution(): {
        histogram: HistogramBucket[];
        stats: DistributionStats;
    };
    /**
     * Get stability distribution histogram
     */
    getStabilityDistribution(): {
        histogram: HistogramBucket[];
        stats: DistributionStats;
    };
    /**
     * Get difficulty distribution histogram
     */
    getDifficultyDistribution(): {
        histogram: HistogramBucket[];
        stats: DistributionStats;
    };
    /**
     * Get combined distribution data for charts
     */
    getAllDistributions(): {
        interval: {
            histogram: HistogramBucket[];
            stats: DistributionStats;
        };
        stability: {
            histogram: HistogramBucket[];
            stats: DistributionStats;
        };
        difficulty: {
            histogram: HistogramBucket[];
            stats: DistributionStats;
        };
    };
    /**
     * Build histogram from values and bucket definitions
     */
    private buildHistogram;
    /**
     * Calculate statistics for a set of values
     */
    private calculateStats;
    /**
     * Empty statistics object
     */
    private emptyStats;
}
