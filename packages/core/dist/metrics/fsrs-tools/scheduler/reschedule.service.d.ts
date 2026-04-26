/**
 * Reschedule Service
 *
 * Recalculates all card intervals based on current FSRS weights.
 * Useful after parameter optimization to apply new weights to existing cards.
 */
import type { FSRSSettings } from "../../../types";
import type { RescheduleOptions, SchedulerCardStore, SchedulingResult } from "./scheduler.types";
export declare class RescheduleService {
    private cardStore;
    private fsrs;
    constructor(cardStore: SchedulerCardStore, fsrsSettings: FSRSSettings);
    /**
     * Reschedule cards based on current FSRS weights
     */
    reschedule(options: RescheduleOptions): SchedulingResult;
    /**
     * Get cards based on scope
     */
    private getCardsForScope;
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
