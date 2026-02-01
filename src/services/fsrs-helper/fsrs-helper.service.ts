/**
 * FSRS Helper Service
 *
 * Facade coordinating all FSRS Helper features:
 * - Parameter optimization
 * - Load balancing and scheduling
 * - Statistics and analysis
 */

import type { TrueRecallSettings, FSRSSettings } from "../../types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";

// Optimizer
import { ParameterOptimizerService } from "./optimizer/parameter-optimizer.service";
import type {
	OptimizationInput,
	OptimizationOutput,
	OptimizerOptions,
} from "./optimizer/optimizer.types";

// Scheduler services
import { LoadBalanceService } from "./scheduler/load-balance.service";
import { EasyDaysService, type EasyDaysOptions } from "./scheduler/easy-days.service";
import { PostponeAdvanceService } from "./scheduler/postpone-advance.service";
import { FlattenService } from "./scheduler/flatten.service";
import { SiblingDisperseService } from "./scheduler/sibling-disperse.service";
import { ScheduleBreakService } from "./scheduler/schedule-break.service";
import { RescheduleService } from "./scheduler/reschedule.service";
import type {
	LoadBalanceOptions,
	ShiftOptions,
	FlattenOptions,
	DisperseOptions,
	RescheduleOptions,
	BreakScheduleOptions,
	SchedulingResult,
	WorkloadDistribution,
} from "./scheduler/scheduler.types";

// Statistics
import { TrueRetentionCalculator, type TrueRetentionSummary } from "./statistics/true-retention.calculator";
import { WorkloadForecastCalculator, type WorkloadForecastEntry, type WorkloadForecastSummary } from "./statistics/workload-forecast.calculator";
import { DistributionCalculator, type HistogramBucket, type DistributionStats } from "./statistics/distribution.calculator";

/**
 * FSRS Helper Service
 *
 * Main entry point for all FSRS Helper functionality.
 * Provides a unified API for optimization, scheduling, and statistics.
 */
export class FSRSHelperService {
	// Sub-services
	private optimizer: ParameterOptimizerService;
	private loadBalancer: LoadBalanceService;
	private easyDays: EasyDaysService;
	private postponeAdvance: PostponeAdvanceService;
	private flatten: FlattenService;
	private siblingDisperse: SiblingDisperseService;
	private scheduleBreak: ScheduleBreakService;
	private reschedule: RescheduleService;

	// Calculators
	private trueRetention: TrueRetentionCalculator;
	private workloadForecast: WorkloadForecastCalculator;
	private distribution: DistributionCalculator;

	constructor(
		private cardStore: SqliteStoreService,
		private settings: TrueRecallSettings
	) {
		// Initialize optimizer
		this.optimizer = new ParameterOptimizerService();

		// Initialize schedulers
		this.loadBalancer = new LoadBalanceService(cardStore);
		this.easyDays = new EasyDaysService(cardStore);
		this.postponeAdvance = new PostponeAdvanceService(cardStore);
		this.flatten = new FlattenService(cardStore);
		this.siblingDisperse = new SiblingDisperseService(cardStore);
		this.scheduleBreak = new ScheduleBreakService(cardStore);
		this.reschedule = new RescheduleService(cardStore, this.extractFSRSSettings());

		// Initialize calculators
		this.trueRetention = new TrueRetentionCalculator(cardStore);
		this.workloadForecast = new WorkloadForecastCalculator(cardStore);
		this.distribution = new DistributionCalculator(cardStore);
	}

	/**
	 * Update settings (called when settings change)
	 */
	updateSettings(settings: TrueRecallSettings): void {
		this.settings = settings;
		// Recreate reschedule service with new settings
		this.reschedule = new RescheduleService(
			this.cardStore,
			this.extractFSRSSettings()
		);
	}

	// ===== Parameter Optimization =====

	/**
	 * Optimize FSRS parameters
	 */
	async optimizeParameters(
		options?: OptimizerOptions
	): Promise<OptimizationOutput> {
		// Get review data from store
		const reviews = this.cardStore.getReviewDataForOptimization();

		const input: OptimizationInput = {
			reviews,
			currentWeights: this.settings.fsrsWeights ?? undefined,
			minReviews: 400,
		};

		return this.optimizer.optimize(input, options);
	}

	/**
	 * Validate weights array
	 */
	validateWeights(weights: number[]): boolean {
		return this.optimizer.validateWeights(weights);
	}

	// ===== Load Balancing =====

	/**
	 * Balance workload over a date range
	 */
	async balanceWorkload(options?: Partial<LoadBalanceOptions>): Promise<SchedulingResult> {
		return this.loadBalancer.balance({
			targetPerDay: options?.targetPerDay ?? this.settings.loadBalanceTarget,
			maxDeviation: options?.maxDeviation ?? this.settings.loadBalanceMaxDeviation,
			days: options?.days ?? 30,
			easyDays: options?.easyDays ?? this.settings.easyDays,
			easyDaysMultiplier: options?.easyDaysMultiplier ?? this.settings.easyDaysMultiplier,
			dryRun: options?.dryRun ?? true,
		});
	}

	/**
	 * Get current workload distribution
	 */
	getWorkloadDistribution(days: number = 30): WorkloadDistribution[] {
		return this.loadBalancer.getDistribution(days);
	}

	// ===== Easy Days =====

	/**
	 * Apply easy days configuration
	 */
	async applyEasyDays(options?: Partial<EasyDaysOptions>): Promise<SchedulingResult> {
		return this.easyDays.applyEasyDays({
			easyDays: options?.easyDays ?? this.settings.easyDays,
			multiplier: options?.multiplier ?? this.settings.easyDaysMultiplier,
			targetPerDay: options?.targetPerDay ?? this.settings.loadBalanceTarget,
			days: options?.days ?? 30,
			dryRun: options?.dryRun ?? true,
		});
	}

	/**
	 * Preview easy days impact
	 */
	previewEasyDays(): { totalMoved: number; byDay: { day: string; moved: number }[] } {
		return this.easyDays.previewImpact(
			this.settings.easyDays,
			this.settings.easyDaysMultiplier,
			this.settings.loadBalanceTarget
		);
	}

	// ===== Postpone/Advance =====

	/**
	 * Shift card due dates
	 */
	async shiftDueDates(options: ShiftOptions): Promise<SchedulingResult> {
		return this.postponeAdvance.shift(options);
	}

	// ===== Flatten =====

	/**
	 * Flatten a specific date
	 */
	async flattenDate(options: FlattenOptions): Promise<SchedulingResult> {
		return this.flatten.flatten(options);
	}

	/**
	 * Find overloaded days
	 */
	findOverloadedDays(maxCards: number, days: number = 30): { date: string; count: number; excess: number }[] {
		return this.flatten.findOverloadedDays(maxCards, days);
	}

	// ===== Sibling Disperse =====

	/**
	 * Disperse sibling cards
	 */
	async disperseSiblings(options?: Partial<DisperseOptions>): Promise<SchedulingResult> {
		return this.siblingDisperse.disperse({
			minInterval: options?.minInterval ?? this.settings.siblingMinInterval,
			sourceUid: options?.sourceUid,
			dryRun: options?.dryRun ?? true,
		});
	}

	/**
	 * Find sibling violations
	 */
	findSiblingViolations(): { sourceUid: string; cardCount: number; violations: number }[] {
		return this.siblingDisperse.findViolations(this.settings.siblingMinInterval);
	}

	// ===== Schedule Break =====

	/**
	 * Schedule a break and redistribute cards
	 */
	async scheduleBreakPeriod(options: BreakScheduleOptions): Promise<SchedulingResult> {
		return this.scheduleBreak.scheduleBreak(options);
	}

	/**
	 * Preview break impact
	 */
	previewBreak(startDate: string, endDate: string): { cardsAffected: number; breakDays: number } {
		return this.scheduleBreak.previewBreak(startDate, endDate);
	}

	// ===== Reschedule =====

	/**
	 * Reschedule cards based on current weights
	 */
	async rescheduleCards(options: RescheduleOptions): Promise<SchedulingResult> {
		return this.reschedule.reschedule(options);
	}

	// ===== Statistics =====

	/**
	 * Get true retention summary
	 */
	getTrueRetentionSummary(days: number = 30): TrueRetentionSummary {
		return this.trueRetention.getSummary(
			this.settings.fsrsRequestRetention,
			days
		);
	}

	/**
	 * Get true retention rolling average
	 */
	getTrueRetentionHistory(days: number = 30): { date: string; retention: number; reviewCount: number }[] {
		return this.trueRetention.getRollingAverage(days);
	}

	/**
	 * Get workload forecast
	 */
	getWorkloadForecast(days: number = 30): WorkloadForecastEntry[] {
		return this.workloadForecast.getForecast(days);
	}

	/**
	 * Get workload forecast summary
	 */
	getWorkloadForecastSummary(days: number = 30): WorkloadForecastSummary {
		return this.workloadForecast.getSummary(
			this.settings.loadBalanceTarget,
			days
		);
	}

	/**
	 * Get workload by day of week
	 */
	getWorkloadByDayOfWeek(days: number = 30): { day: number; dayName: string; avgCount: number }[] {
		return this.workloadForecast.getWorkloadByDayOfWeek(days);
	}

	/**
	 * Get all distribution statistics
	 */
	getDistributions(): {
		interval: { histogram: HistogramBucket[]; stats: DistributionStats };
		stability: { histogram: HistogramBucket[]; stats: DistributionStats };
		difficulty: { histogram: HistogramBucket[]; stats: DistributionStats };
	} {
		return this.distribution.getAllDistributions();
	}

	// ===== Helpers =====

	/**
	 * Extract FSRS settings subset
	 */
	private extractFSRSSettings(): FSRSSettings {
		return {
			requestRetention: this.settings.fsrsRequestRetention,
			maximumInterval: this.settings.fsrsMaximumInterval,
			weights: this.settings.fsrsWeights,
			learningSteps: this.settings.learningSteps,
			relearningSteps: this.settings.relearningSteps,
			enableShortTerm: true,
		};
	}
}
