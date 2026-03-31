/**
 * True Retention Calculator
 *
 * Calculates actual retention rate based on review history,
 * focusing only on mature cards (Review state) for accuracy.
 */
import type { SqliteStoreService } from "../../../persistence/sqlite/SqliteStoreService";
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
export interface TrueRetentionSnapshot {
    summary: TrueRetentionSummary;
    history: TrueRetentionEntry[];
}
/**
 * True Retention Calculator
 *
 * Unlike simple retention (all cards), true retention only counts
 * reviews on mature cards (state = Review, interval >= 21 days).
 * This gives a more accurate picture of long-term memory retention.
 */
export declare class TrueRetentionCalculator {
    private cardStore;
    constructor(cardStore: SqliteStoreService);
    /**
     * Calculate true retention for a date range
     */
    calculate(startDate: string, endDate: string, presetNames?: string[]): TrueRetentionEntry[];
    /**
     * Get summary statistics
     */
    getSummary(targetRetention: number, days?: number, presetNames?: string[]): TrueRetentionSummary;
    getSummaryAndRolling(targetRetention: number, days?: number, window?: number, presetNames?: string[]): TrueRetentionSnapshot;
    private buildSummary;
    /**
     * Get rolling average retention
     */
    getRollingAverage(days?: number, window?: number, presetNames?: string[]): TrueRetentionEntry[];
    private buildRollingAverage;
}
