/**
 * FSRS Helper Module
 *
 * Provides advanced FSRS functionality:
 * - Parameter optimization
 * - Load balancing and scheduling
 * - Statistics and analysis
 */

// Main service
export { FSRSHelperService } from "./fsrs-helper.service";

// Optimizer
export { ParameterOptimizerService } from "./optimizer/parameter-optimizer.service";
export type {
	OptimizationInput,
	OptimizationOutput,
	OptimizationReviewEntry,
	OptimizerOptions,
	OptimizationProgressCallback,
} from "./optimizer/optimizer.types";

// Scheduler services
export { LoadBalanceService } from "./scheduler/load-balance.service";
export { EasyDaysService, type EasyDaysOptions } from "./scheduler/easy-days.service";
export { PostponeAdvanceService } from "./scheduler/postpone-advance.service";
export { FlattenService } from "./scheduler/flatten.service";
export { SiblingDisperseService } from "./scheduler/sibling-disperse.service";
export { ScheduleBreakService } from "./scheduler/schedule-break.service";
export { RescheduleService } from "./scheduler/reschedule.service";
export type {
	CardDueInfo,
	WorkloadDistribution,
	SchedulingResult,
	CardScheduleChange,
	LoadBalanceOptions,
	ShiftOptions,
	FlattenOptions,
	DisperseOptions,
	RescheduleOptions,
	BreakScheduleOptions,
} from "./scheduler/scheduler.types";

// Statistics
export { TrueRetentionCalculator, type TrueRetentionEntry, type TrueRetentionSummary } from "./statistics/true-retention.calculator";
export { WorkloadForecastCalculator, type WorkloadForecastEntry, type WorkloadForecastSummary } from "./statistics/workload-forecast.calculator";
export { DistributionCalculator, type HistogramBucket, type DistributionStats } from "./statistics/distribution.calculator";
