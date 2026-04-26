import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";
import type { TrueRecallSettings } from "../../types";
import type { OptimizationOutput, OptimizerOptions } from "./optimizer/optimizer.types";
import { type EasyDaysOptions } from "./scheduler/easy-days.service";
import type { BreakScheduleOptions, DisperseOptions, FlattenOptions, LoadBalanceOptions, RescheduleOptions, SchedulingResult, ShiftOptions, WorkloadDistribution } from "./scheduler/scheduler.types";
import { type DistributionStats, type HistogramBucket } from "./statistics/distribution.calculator";
import { type TrueRetentionSnapshot, type TrueRetentionSummary } from "./statistics/true-retention.calculator";
import { type WorkloadForecastEntry, type WorkloadForecastSummary } from "./statistics/workload-forecast.calculator";
export declare class FSRSHelperService {
    private cardStore;
    private settings;
    private optimizer;
    private loadBalancer;
    private easyDays;
    private postponeAdvance;
    private flatten;
    private siblingDisperse;
    private scheduleBreak;
    private reschedule;
    private trueRetention;
    private workloadForecast;
    private distribution;
    constructor(cardStore: SqliteStoreService, settings: TrueRecallSettings);
    updateSettings(settings: TrueRecallSettings): void;
    optimizeParameters(options?: OptimizerOptions, presetName?: string, currentWeights?: number[] | null): OptimizationOutput;
    validateWeights(weights: number[]): boolean;
    balanceWorkload(options?: Partial<LoadBalanceOptions>): SchedulingResult;
    getWorkloadDistribution(days?: number): WorkloadDistribution[];
    applyEasyDays(options?: Partial<EasyDaysOptions>): SchedulingResult;
    previewEasyDays(): {
        totalMoved: number;
        byDay: {
            day: string;
            moved: number;
        }[];
    };
    shiftDueDates(options: ShiftOptions): SchedulingResult;
    flattenDate(options: FlattenOptions): SchedulingResult;
    findOverloadedDays(maxCards: number, days?: number): {
        date: string;
        count: number;
        excess: number;
    }[];
    disperseSiblings(options?: Partial<DisperseOptions>): SchedulingResult;
    findSiblingViolations(): {
        sourceUid: string;
        cardCount: number;
        violations: number;
    }[];
    scheduleBreakPeriod(options: BreakScheduleOptions): SchedulingResult;
    previewBreak(startDate: string, endDate: string): {
        cardsAffected: number;
        breakDays: number;
    };
    rescheduleCards(options: RescheduleOptions): SchedulingResult;
    getTrueRetentionSummary(days?: number, presetNames?: string[]): TrueRetentionSummary;
    getTrueRetentionSnapshot(days?: number, presetNames?: string[]): TrueRetentionSnapshot;
    getTrueRetentionHistory(days?: number, presetNames?: string[]): {
        date: string;
        retention: number;
        reviewCount: number;
    }[];
    getWorkloadForecast(days?: number, excludeSourceUids?: ReadonlySet<string>): WorkloadForecastEntry[];
    getWorkloadForecastSummary(days?: number, excludeSourceUids?: ReadonlySet<string>): WorkloadForecastSummary;
    getWorkloadByDayOfWeek(days?: number, excludeSourceUids?: ReadonlySet<string>): {
        day: number;
        dayName: string;
        avgCount: number;
    }[];
    getDistributions(): {
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
    private extractFSRSSettings;
}
