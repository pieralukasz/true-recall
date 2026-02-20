import type { FSRSSettings, TrueRecallSettings } from "@shared/types";
import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import type {
	OptimizationInput,
	OptimizationOutput,
	OptimizerOptions,
} from "@features/metrics/services/fsrs-tools/optimizer/optimizer.types";
import { ParameterOptimizerService } from "@features/metrics/services/fsrs-tools/optimizer/parameter-optimizer.service";
import {
	type EasyDaysOptions,
	EasyDaysService,
} from "@features/metrics/services/fsrs-tools/scheduler/easy-days.service";
import { FlattenService } from "@features/metrics/services/fsrs-tools/scheduler/flatten.service";
import { LoadBalanceService } from "@features/metrics/services/fsrs-tools/scheduler/load-balance.service";
import { PostponeAdvanceService } from "@features/metrics/services/fsrs-tools/scheduler/postpone-advance.service";
import { RescheduleService } from "@features/metrics/services/fsrs-tools/scheduler/reschedule.service";
import { ScheduleBreakService } from "@features/metrics/services/fsrs-tools/scheduler/schedule-break.service";
import type {
	BreakScheduleOptions,
	DisperseOptions,
	FlattenOptions,
	LoadBalanceOptions,
	RescheduleOptions,
	SchedulingResult,
	ShiftOptions,
	WorkloadDistribution,
} from "@features/metrics/services/fsrs-tools/scheduler/scheduler.types";
import { SiblingDisperseService } from "@features/metrics/services/fsrs-tools/scheduler/sibling-disperse.service";
import {
	DistributionCalculator,
	type DistributionStats,
	type HistogramBucket,
} from "@features/metrics/services/fsrs-tools/statistics/distribution.calculator";
import {
	TrueRetentionCalculator,
	type TrueRetentionSummary,
} from "@features/metrics/services/fsrs-tools/statistics/true-retention.calculator";
import {
	WorkloadForecastCalculator,
	type WorkloadForecastEntry,
	type WorkloadForecastSummary,
} from "@features/metrics/services/fsrs-tools/statistics/workload-forecast.calculator";

export class FSRSHelperService {
	private optimizer: ParameterOptimizerService;
	private loadBalancer: LoadBalanceService;
	private easyDays: EasyDaysService;
	private postponeAdvance: PostponeAdvanceService;
	private flatten: FlattenService;
	private siblingDisperse: SiblingDisperseService;
	private scheduleBreak: ScheduleBreakService;
	private reschedule: RescheduleService;

	private trueRetention: TrueRetentionCalculator;
	private workloadForecast: WorkloadForecastCalculator;
	private distribution: DistributionCalculator;

	constructor(
		private cardStore: SqliteStoreService,
		private settings: TrueRecallSettings,
	) {
		this.optimizer = new ParameterOptimizerService();

		this.loadBalancer = new LoadBalanceService(cardStore);
		this.easyDays = new EasyDaysService(cardStore);
		this.postponeAdvance = new PostponeAdvanceService(cardStore);
		this.flatten = new FlattenService(cardStore);
		this.siblingDisperse = new SiblingDisperseService(cardStore);
		this.scheduleBreak = new ScheduleBreakService(cardStore);
		this.reschedule = new RescheduleService(
			cardStore,
			this.extractFSRSSettings(),
		);

		this.trueRetention = new TrueRetentionCalculator(cardStore);
		this.workloadForecast = new WorkloadForecastCalculator(cardStore);
		this.distribution = new DistributionCalculator(cardStore);
	}

	updateSettings(settings: TrueRecallSettings): void {
		this.settings = settings;
		this.reschedule = new RescheduleService(
			this.cardStore,
			this.extractFSRSSettings(),
		);
	}

	async optimizeParameters(
		options?: OptimizerOptions,
		presetName?: string,
		currentWeights?: number[] | null,
	): Promise<OptimizationOutput> {
		const reviews = this.cardStore.getReviewDataForOptimization(presetName);

		const input: OptimizationInput = {
			reviews,
			currentWeights: currentWeights ?? this.settings.fsrsWeights ?? undefined,
			minReviews: 400,
		};

		return this.optimizer.optimize(input, options);
	}

	validateWeights(weights: number[]): boolean {
		return this.optimizer.validateWeights(weights);
	}

	async balanceWorkload(
		options?: Partial<LoadBalanceOptions>,
	): Promise<SchedulingResult> {
		return this.loadBalancer.balance({
			targetPerDay: options?.targetPerDay ?? this.settings.loadBalanceTarget,
			maxDeviation:
				options?.maxDeviation ?? this.settings.loadBalanceMaxDeviation,
			days: options?.days ?? 30,
			easyDays: options?.easyDays ?? this.settings.easyDays,
			easyDaysMultiplier:
				options?.easyDaysMultiplier ?? this.settings.easyDaysMultiplier,
			dryRun: options?.dryRun ?? true,
		});
	}

	getWorkloadDistribution(days: number = 30): WorkloadDistribution[] {
		return this.loadBalancer.getDistribution(days);
	}

	async applyEasyDays(
		options?: Partial<EasyDaysOptions>,
	): Promise<SchedulingResult> {
		return this.easyDays.applyEasyDays({
			easyDays: options?.easyDays ?? this.settings.easyDays,
			multiplier: options?.multiplier ?? this.settings.easyDaysMultiplier,
			targetPerDay: options?.targetPerDay ?? this.settings.loadBalanceTarget,
			days: options?.days ?? 30,
			dryRun: options?.dryRun ?? true,
		});
	}

	previewEasyDays(): {
		totalMoved: number;
		byDay: { day: string; moved: number }[];
	} {
		return this.easyDays.previewImpact(
			this.settings.easyDays,
			this.settings.easyDaysMultiplier,
			this.settings.loadBalanceTarget,
		);
	}

	async shiftDueDates(options: ShiftOptions): Promise<SchedulingResult> {
		return this.postponeAdvance.shift(options);
	}

	async flattenDate(options: FlattenOptions): Promise<SchedulingResult> {
		return this.flatten.flatten(options);
	}

	findOverloadedDays(
		maxCards: number,
		days: number = 30,
	): { date: string; count: number; excess: number }[] {
		return this.flatten.findOverloadedDays(maxCards, days);
	}

	async disperseSiblings(
		options?: Partial<DisperseOptions>,
	): Promise<SchedulingResult> {
		return this.siblingDisperse.disperse({
			minInterval: options?.minInterval ?? this.settings.siblingMinInterval,
			sourceUid: options?.sourceUid,
			dryRun: options?.dryRun ?? true,
		});
	}

	findSiblingViolations(): {
		sourceUid: string;
		cardCount: number;
		violations: number;
	}[] {
		return this.siblingDisperse.findViolations(
			this.settings.siblingMinInterval,
		);
	}

	async scheduleBreakPeriod(
		options: BreakScheduleOptions,
	): Promise<SchedulingResult> {
		return this.scheduleBreak.scheduleBreak(options);
	}

	previewBreak(
		startDate: string,
		endDate: string,
	): { cardsAffected: number; breakDays: number } {
		return this.scheduleBreak.previewBreak(startDate, endDate);
	}

	async rescheduleCards(options: RescheduleOptions): Promise<SchedulingResult> {
		return this.reschedule.reschedule(options);
	}

	getTrueRetentionSummary(days: number = 30): TrueRetentionSummary {
		return this.trueRetention.getSummary(
			this.settings.fsrsRequestRetention,
			days,
		);
	}

	getTrueRetentionHistory(
		days: number = 30,
	): { date: string; retention: number; reviewCount: number }[] {
		return this.trueRetention.getRollingAverage(days);
	}

	getWorkloadForecast(days: number = 30): WorkloadForecastEntry[] {
		return this.workloadForecast.getForecast(days);
	}

	getWorkloadForecastSummary(days: number = 30): WorkloadForecastSummary {
		return this.workloadForecast.getSummary(
			this.settings.loadBalanceTarget,
			days,
		);
	}

	getWorkloadByDayOfWeek(
		days: number = 30,
	): { day: number; dayName: string; avgCount: number }[] {
		return this.workloadForecast.getWorkloadByDayOfWeek(days);
	}

	getDistributions(): {
		interval: { histogram: HistogramBucket[]; stats: DistributionStats };
		stability: { histogram: HistogramBucket[]; stats: DistributionStats };
		difficulty: { histogram: HistogramBucket[]; stats: DistributionStats };
	} {
		return this.distribution.getAllDistributions();
	}

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
