/**
 * Postpone/Advance Service
 *
 * Shifts card due dates forward (postpone) or backward (advance) in bulk.
 */
import type { SchedulerCardStore, SchedulingResult, ShiftOptions } from "./scheduler.types";
/**
 * Postpone/Advance Service
 *
 * Allows bulk shifting of due dates for workload management.
 */
export declare class PostponeAdvanceService {
    private cardStore;
    constructor(cardStore: SchedulerCardStore);
    /**
     * Shift card due dates
     */
    shift(options: ShiftOptions): SchedulingResult;
    /**
     * Get cards based on scope
     */
    private getCardsForScope;
    /**
     * Format date as YYYY-MM-DD
     */
    private formatDate;
    /**
     * Convert distribution map to array
     */
    private mapToDistribution;
}
