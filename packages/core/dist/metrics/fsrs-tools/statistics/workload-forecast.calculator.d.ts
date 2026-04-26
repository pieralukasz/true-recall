/**
 * Workload Forecast Calculator
 *
 * Predicts future review workload based on current card scheduling.
 */
import type { SqliteStoreService } from "../../../persistence/sqlite/SqliteStoreService";
/**
 * Daily workload forecast entry
 */
export interface WorkloadForecastEntry {
    /** Date (ISO date string) */
    date: string;
    /** Number of reviews due */
    dueCount: number;
    /** Breakdown by card state */
    breakdown: {
        /** Cards in Review state */
        review: number;
        /** Cards in Learning/Relearning state */
        learning: number;
    };
}
/**
 * Workload forecast summary
 */
export interface WorkloadForecastSummary {
    /** Average daily workload */
    avgDaily: number;
    /** Peak day */
    peakDay: {
        date: string;
        count: number;
    };
    /** Minimum day */
    minDay: {
        date: string;
        count: number;
    };
    /** Days above target */
    daysAboveTarget: number;
    /** Recommended balance */
    needsBalancing: boolean;
}
/**
 * Workload Forecast Calculator
 *
 * Analyzes scheduled cards to predict future workload,
 * helping users plan their study time.
 */
export declare class WorkloadForecastCalculator {
    private cardStore;
    constructor(cardStore: SqliteStoreService);
    /**
     * Get workload forecast for the next N days
     */
    getForecast(days?: number, excludeSourceUids?: ReadonlySet<string>): WorkloadForecastEntry[];
    /**
     * Get summary statistics for the forecast
     */
    getSummary(targetPerDay: number, days?: number, excludeSourceUids?: ReadonlySet<string>): WorkloadForecastSummary;
    /**
     * Get cumulative workload (total reviews needed by each date)
     */
    getCumulativeForecast(days?: number): {
        date: string;
        cumulative: number;
    }[];
    /**
     * Get workload by day of week
     */
    getWorkloadByDayOfWeek(days?: number, excludeSourceUids?: ReadonlySet<string>): {
        day: number;
        dayName: string;
        avgCount: number;
    }[];
}
