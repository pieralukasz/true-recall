/**
 * Sibling Disperse Service
 *
 * Spreads cards from the same source note to prevent seeing related content
 * too close together in time.
 */
import type { DisperseOptions, SchedulerCardStore, SchedulingResult } from "./scheduler.types";
/**
 * Sibling Disperse Service
 *
 * Cards from the same source note are "siblings". This service ensures
 * siblings are spaced apart by a minimum interval to avoid interference.
 */
export declare class SiblingDisperseService {
    private cardStore;
    constructor(cardStore: SchedulerCardStore);
    /**
     * Disperse sibling cards
     */
    disperse(options: DisperseOptions): SchedulingResult;
    /**
     * Get sibling group for a specific source UID
     */
    private getSiblingGroup;
    /**
     * Get all sibling groups (groups with more than 1 card)
     */
    private getAllSiblingGroups;
    /**
     * Find sibling pairs that violate the minimum interval
     */
    findViolations(minInterval: number): {
        sourceUid: string;
        cardCount: number;
        violations: number;
    }[];
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
