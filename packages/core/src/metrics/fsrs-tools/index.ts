/**
 * FSRS Helper Module
 *
 * Provides advanced FSRS functionality:
 * - Parameter optimization
 * - Load balancing and scheduling
 * - Statistics and analysis
 */

// Main service
export {
	FSRSHelperService,
	type WorkloadDecision,
} from "./fsrs-helper.service";
export {
	type CatchUpProjection,
	MIN_ACTIVE_DAYS,
	PACE_LOOKBACK_DAYS,
	type PaceStats,
	projectCatchUp,
} from "./scheduler/target-suggestion";
export type {
	OptimizationInput,
	OptimizationOutput,
	OptimizationProgressCallback,
	OptimizationReviewEntry,
	OptimizerOptions,
} from "./optimizer/optimizer.types";
// Optimizer
export { ParameterOptimizerService } from "./optimizer/parameter-optimizer.service";
export {
	type EasyDaysOptions,
	EasyDaysService,
} from "./scheduler/easy-days.service";
export { FlattenService } from "./scheduler/flatten.service";
// Scheduler services
export { LoadBalanceService } from "./scheduler/load-balance.service";
export { PostponeAdvanceService } from "./scheduler/postpone-advance.service";
export { RescheduleService } from "./scheduler/reschedule.service";
export { ScheduleBreakService } from "./scheduler/schedule-break.service";
export type {
	BreakScheduleOptions,
	CardDueInfo,
	CardScheduleChange,
	DisperseOptions,
	FlattenOptions,
	LoadBalanceOptions,
	RescheduleOptions,
	SchedulingResult,
	ShiftOptions,
	WorkloadDistribution,
} from "./scheduler/scheduler.types";
export { SiblingDisperseService } from "./scheduler/sibling-disperse.service";
export {
	DistributionCalculator,
	type DistributionStats,
	type HistogramBucket,
} from "./statistics/distribution.calculator";
// Statistics
export {
	TrueRetentionCalculator,
	type TrueRetentionEntry,
	type TrueRetentionSnapshot,
	type TrueRetentionSummary,
} from "./statistics/true-retention.calculator";
export {
	WorkloadForecastCalculator,
	type WorkloadForecastEntry,
	type WorkloadForecastSummary,
} from "./statistics/workload-forecast.calculator";
