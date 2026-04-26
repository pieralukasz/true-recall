/**
 * Easy Days Service
 *
 * Manages reduced workload on specific days (recurring weekdays + specific dates).
 */
import type { EasyDaysConfig } from "../../../types";
import type { SchedulerCardStore, SchedulingResult } from "./scheduler.types";
export interface EasyDaysOptions {
    /** Easy days configuration (recurring weekdays + specific dates) */
    easyDays: EasyDaysConfig;
    /** Workload multiplier for easy days (0.0-1.0) */
    multiplier: number;
    /** Target daily reviews for normal days */
    targetPerDay: number;
    /** Number of days to process */
    days?: number;
    /** Dry run - don't apply changes */
    dryRun?: boolean;
}
export declare function isEasyDay(date: Date, easyDays: EasyDaysConfig): boolean;
export declare class EasyDaysService {
    private cardStore;
    constructor(cardStore: SchedulerCardStore);
    applyEasyDays(options: EasyDaysOptions): SchedulingResult;
    private findNextNonEasyDay;
    previewImpact(easyDays: EasyDaysConfig, multiplier: number, targetPerDay: number, days?: number): {
        totalMoved: number;
        byDay: {
            day: string;
            moved: number;
        }[];
    };
    private daysBetween;
    private formatDate;
    private mapToDistribution;
}
