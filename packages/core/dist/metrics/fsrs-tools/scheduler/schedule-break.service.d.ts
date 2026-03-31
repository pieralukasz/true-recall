/**
 * Schedule Break Service
 *
 * Redistributes cards during a scheduled break (vacation) to prevent
 * workload accumulation.
 */
import type { BreakScheduleOptions, SchedulerCardStore, SchedulingResult } from "./scheduler.types";
/**
 * Schedule Break Service
 *
 * When a user schedules a break, cards that would be due during the break
 * are redistributed to before or after the break period.
 */
export declare class ScheduleBreakService {
    private cardStore;
    constructor(cardStore: SchedulerCardStore);
    /**
     * Schedule a break and redistribute cards
     */
    scheduleBreak(options: BreakScheduleOptions): SchedulingResult;
    /**
     * Preview the impact of a break
     */
    previewBreak(startDate: string, endDate: string): {
        cardsAffected: number;
        breakDays: number;
    };
    /**
     * Calculate days between two dates
     */
    private daysBetween;
    /**
     * Format date as YYYY-MM-DD
     */
    private formatDate;
    /**
     * Convert distribution map to array
     */
    private mapToDistribution;
}
