/**
 * Flatten Service
 *
 * Redistributes excess cards from overloaded days to nearby days.
 */
import type { FlattenOptions, SchedulerCardStore, SchedulingResult } from "./scheduler.types";
/**
 * Flatten Service
 *
 * When a day exceeds the maximum card limit, excess cards are
 * moved to adjacent days to reduce the peak.
 */
export declare class FlattenService {
    private cardStore;
    constructor(cardStore: SchedulerCardStore);
    /**
     * Flatten a specific date by moving excess cards
     */
    flatten(options: FlattenOptions): SchedulingResult;
    /**
     * Find days that exceed the limit
     */
    findOverloadedDays(maxCards: number, days?: number): {
        date: string;
        count: number;
        excess: number;
    }[];
    /**
     * Format date as YYYY-MM-DD
     */
    private formatDate;
    /**
     * Convert distribution map to array
     */
    private mapToDistribution;
}
