/**
 * Distribution Calculator
 *
 * Calculates distribution statistics for card intervals, stability, and difficulty.
 */
import { State } from "ts-fsrs";
/**
 * Distribution Calculator
 *
 * Provides insights into the distribution of card metrics:
 * - Interval distribution (how spread out are review intervals)
 * - Stability distribution (memory strength)
 * - Difficulty distribution (card difficulty ratings)
 */
export class DistributionCalculator {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    /**
     * Get interval distribution histogram
     */
    getIntervalDistribution() {
        const cards = this.cardStore.getCards().filter((c) => !c.suspended && c.state === State.Review);
        const intervals = cards.map((c) => c.scheduledDays);
        if (intervals.length === 0) {
            return {
                histogram: [],
                stats: this.emptyStats(),
            };
        }
        const buckets = [
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
    getStabilityDistribution() {
        const cards = this.cardStore.getCards().filter((c) => !c.suspended && c.state !== State.New);
        const stabilities = cards.map((c) => c.stability);
        if (stabilities.length === 0) {
            return {
                histogram: [],
                stats: this.emptyStats(),
            };
        }
        const buckets = [
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
    getDifficultyDistribution() {
        const cards = this.cardStore.getCards().filter((c) => !c.suspended && c.state !== State.New);
        const difficulties = cards.map((c) => c.difficulty);
        if (difficulties.length === 0) {
            return {
                histogram: [],
                stats: this.emptyStats(),
            };
        }
        const buckets = [
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
    getAllDistributions() {
        return {
            interval: this.getIntervalDistribution(),
            stability: this.getStabilityDistribution(),
            difficulty: this.getDifficultyDistribution(),
        };
    }
    /**
     * Build histogram from values and bucket definitions
     */
    buildHistogram(values, buckets) {
        var _a;
        const total = values.length;
        const counts = new Map();
        for (const [, , label] of buckets) {
            counts.set(label, 0);
        }
        // Count values in each bucket
        for (const value of values) {
            for (const [min, max, label] of buckets) {
                if (value >= min && value < max) {
                    counts.set(label, ((_a = counts.get(label)) !== null && _a !== void 0 ? _a : 0) + 1);
                    break;
                }
            }
        }
        // Build histogram
        return buckets.map(([min, max, label]) => {
            var _a;
            const count = (_a = counts.get(label)) !== null && _a !== void 0 ? _a : 0;
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
    calculateStats(values) {
        var _a, _b, _c, _d, _e;
        if (values.length === 0)
            return this.emptyStats();
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        const min = (_a = sorted[0]) !== null && _a !== void 0 ? _a : 0;
        const max = (_b = sorted[n - 1]) !== null && _b !== void 0 ? _b : 0;
        const sum = sorted.reduce((a, b) => a + b, 0);
        const mean = sum / n;
        // Median
        const median = n % 2 === 0
            ? (((_c = sorted[n / 2 - 1]) !== null && _c !== void 0 ? _c : 0) + ((_d = sorted[n / 2]) !== null && _d !== void 0 ? _d : 0)) / 2
            : ((_e = sorted[Math.floor(n / 2)]) !== null && _e !== void 0 ? _e : 0);
        // Standard deviation
        const squaredDiffs = sorted.map((v) => Math.pow((v - mean), 2));
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
    emptyStats() {
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
