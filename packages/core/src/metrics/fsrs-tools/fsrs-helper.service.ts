import { State } from "ts-fsrs";

import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";
import { formatLocalDate, getTodayBoundary } from "../../utils";
import type {
	FSRSCardData,
	FSRSSettings,
	SchedulingPreview,
	SchedulingPreviewEntry,
	TrueRecallSettings,
} from "../../types";
import { formatInterval } from "../../types/fsrs/fsrs.utils";
import type {
	OptimizationInput,
	OptimizationOutput,
	OptimizerOptions,
} from "./optimizer/optimizer.types";
import { ParameterOptimizerService } from "./optimizer/parameter-optimizer.service";
import {
	type EasyDaysOptions,
	EasyDaysService,
} from "./scheduler/easy-days.service";
import { FlattenService } from "./scheduler/flatten.service";
import { LoadBalanceService } from "./scheduler/load-balance.service";
import { PostponeAdvanceService } from "./scheduler/postpone-advance.service";
import { RescheduleService } from "./scheduler/reschedule.service";
import { ScheduleBreakService } from "./scheduler/schedule-break.service";
import type {
	BreakScheduleOptions,
	DisperseOptions,
	FlattenFutureOptions,
	FlattenOptions,
	LoadBalanceOptions,
	RescheduleOptions,
	SchedulingResult,
	ShiftOptions,
	WorkloadDistribution,
} from "./scheduler/scheduler.types";
import { SiblingDisperseService } from "./scheduler/sibling-disperse.service";
import {
	DistributionCalculator,
	type DistributionStats,
	type HistogramBucket,
} from "./statistics/distribution.calculator";
import {
	TrueRetentionCalculator,
	type TrueRetentionSnapshot,
	type TrueRetentionSummary,
} from "./statistics/true-retention.calculator";
import {
	WorkloadForecastCalculator,
	type WorkloadForecastEntry,
	type WorkloadForecastSummary,
} from "./statistics/workload-forecast.calculator";

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

	/** Manual target when configured, undefined in auto mode (core derives it) */
	private resolveLoadBalanceTarget(): number | undefined {
		return this.settings.loadBalanceTargetMode === "manual"
			? this.settings.loadBalanceTarget
			: undefined;
	}

	/** The daily target actually in effect: manual value or forecast average */
	getEffectiveLoadBalanceTarget(): number {
		return (
			this.resolveLoadBalanceTarget() ??
			this.loadBalancer.computeAutoTarget(
				this.settings.easyDays,
				this.settings.easyDaysMultiplier,
			)
		);
	}

	balanceWorkload(options?: Partial<LoadBalanceOptions>): SchedulingResult {
		const days = options?.days ?? this.settings.loadBalanceBulkDays;
		return this.loadBalancer.balance({
			targetPerDay: options?.targetPerDay ?? this.resolveLoadBalanceTarget(),
			maxDeviation:
				options?.maxDeviation ?? this.settings.loadBalanceMaxDeviation,
			days: days === 0 ? 36500 : days,
			easyDays: options?.easyDays ?? this.settings.easyDays,
			easyDaysMultiplier:
				options?.easyDaysMultiplier ?? this.settings.easyDaysMultiplier,
			includeOverdue: options?.includeOverdue,
			cardIds: options?.cardIds,
			completedToday: options?.completedToday ?? this.getCompletedTodayCount(),
			dryRun: options?.dryRun ?? true,
		});
	}

	/** Reviews already answered today, respecting the day-start-hour boundary */
	private getCompletedTodayCount(): number {
		const todayKey = formatLocalDate(
			getTodayBoundary(this.settings.dayStartHour ?? 4),
		);
		return this.cardStore.stats.getDailyStats(todayKey)?.reviewsCompleted ?? 0;
	}

	balanceScheduledReview(cardId: string, fsrs: FSRSCardData): FSRSCardData {
		if (!this.settings.loadBalanceEnabled || fsrs.state !== State.Review) {
			return fsrs;
		}
		if (fsrs.scheduledDays < 1) return fsrs;
		if ((new Date(fsrs.due).getTime() - Date.now()) / (1000 * 60) < 60 * 24) {
			return fsrs;
		}

		const result = this.loadBalancer.balanceDue({
			cardId,
			originalDue: fsrs.due,
			maxShiftDays: this.settings.loadBalanceMaxShiftDays,
			easyDays: this.settings.easyDays,
			easyDaysMultiplier: this.settings.easyDaysMultiplier,
		});

		if (!result.balanced) return fsrs;

		return {
			...fsrs,
			due: result.newDue,
			scheduledDays: Math.max(1, fsrs.scheduledDays + result.daysChanged),
		};
	}

	balanceSchedulingPreview(
		cardId: string,
		preview: SchedulingPreview,
	): SchedulingPreview {
		if (!this.settings.loadBalanceEnabled) return preview;

		return {
			again: this.balancePreviewEntry(cardId, preview.again),
			hard: this.balancePreviewEntry(cardId, preview.hard),
			good: this.balancePreviewEntry(cardId, preview.good),
			easy: this.balancePreviewEntry(cardId, preview.easy),
		};
	}

	getWorkloadDistribution(days: number = 30): WorkloadDistribution[] {
		return this.loadBalancer.getDistribution(days);
	}

	applyEasyDays(options?: Partial<EasyDaysOptions>): SchedulingResult {
		return this.easyDays.applyEasyDays({
			easyDays: options?.easyDays ?? this.settings.easyDays,
			multiplier: options?.multiplier ?? this.settings.easyDaysMultiplier,
			targetPerDay:
				options?.targetPerDay ?? this.getEffectiveLoadBalanceTarget(),
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
			this.getEffectiveLoadBalanceTarget(),
		);
	}

	shiftDueDates(options: ShiftOptions): SchedulingResult {
		return this.postponeAdvance.shift(options);
	}

	flattenDate(options: FlattenOptions): SchedulingResult {
		return this.flatten.flatten(options);
	}

	flattenFutureDueCards(options: FlattenFutureOptions): SchedulingResult {
		return this.flatten.flattenFuture(options);
	}

	findOverloadedDays(
		maxCards: number,
		days: number = 30,
	): { date: string; count: number; excess: number }[] {
		return this.flatten.findOverloadedDays(maxCards, days);
	}

	disperseSiblings(options?: Partial<DisperseOptions>): SchedulingResult {
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

	scheduleBreakPeriod(options: BreakScheduleOptions): SchedulingResult {
		return this.scheduleBreak.scheduleBreak(options);
	}

	previewBreak(
		startDate: string,
		endDate: string,
		cardIds?: string[],
	): { cardsAffected: number; breakDays: number } {
		return this.scheduleBreak.previewBreak(startDate, endDate, cardIds);
	}

	rescheduleCards(options: RescheduleOptions): SchedulingResult {
		return this.reschedule.reschedule(options);
	}

	getTrueRetentionSummary(
		days: number = 30,
		presetNames?: string[],
	): TrueRetentionSummary {
		return this.trueRetention.getSummary(
			this.settings.fsrsRequestRetention,
			days,
			presetNames,
		);
	}

	getTrueRetentionSnapshot(
		days: number = 30,
		presetNames?: string[],
	): TrueRetentionSnapshot {
		return this.trueRetention.getSummaryAndRolling(
			this.settings.fsrsRequestRetention,
			days,
			7,
			presetNames,
		);
	}

	getTrueRetentionHistory(
		days: number = 30,
		presetNames?: string[],
	): { date: string; retention: number; reviewCount: number }[] {
		return this.trueRetention.getRollingAverage(days, 7, presetNames);
	}

	getWorkloadForecast(
		days: number = 30,
		excludeSourceUids?: ReadonlySet<string>,
		includeSourceUids?: ReadonlySet<string>,
	): WorkloadForecastEntry[] {
		return this.workloadForecast.getForecast(
			days,
			excludeSourceUids,
			includeSourceUids,
		);
	}

	getWorkloadForecastSummary(
		days: number = 30,
		excludeSourceUids?: ReadonlySet<string>,
		includeSourceUids?: ReadonlySet<string>,
		targetPerDay?: number,
	): WorkloadForecastSummary {
		const summary = this.workloadForecast.getSummary(
			targetPerDay ?? this.getEffectiveLoadBalanceTarget(),
			days,
			excludeSourceUids,
			this.settings.loadBalanceMaxDeviation,
			includeSourceUids,
		);

		const isScoped =
			(excludeSourceUids && excludeSourceUids.size > 0) ||
			(includeSourceUids && includeSourceUids.size > 0);
		if (isScoped) return summary;

		return {
			...summary,
			needsBalancing:
				this.balanceWorkload({
					days,
					dryRun: true,
				}).affectedCount > 0,
		};
	}

	getWorkloadByDayOfWeek(
		days: number = 30,
		excludeSourceUids?: ReadonlySet<string>,
		includeSourceUids?: ReadonlySet<string>,
	): { day: number; dayName: string; avgCount: number }[] {
		return this.workloadForecast.getWorkloadByDayOfWeek(
			days,
			excludeSourceUids,
			includeSourceUids,
		);
	}

	getDistributions(): {
		interval: { histogram: HistogramBucket[]; stats: DistributionStats };
		stability: { histogram: HistogramBucket[]; stats: DistributionStats };
		difficulty: { histogram: HistogramBucket[]; stats: DistributionStats };
	} {
		return this.distribution.getAllDistributions();
	}

	private balancePreviewEntry(
		cardId: string,
		entry: SchedulingPreviewEntry,
	): SchedulingPreviewEntry {
		const minutesUntilDue = (entry.due.getTime() - Date.now()) / (1000 * 60);
		if (minutesUntilDue < 60 * 24) {
			return {
				...entry,
				originalDue: entry.due,
				originalInterval: entry.interval,
				daysChanged: 0,
				loadBalanceNote:
					"Skipped: load balancing only adjusts review intervals of at least 1 day.",
			};
		}

		const result = this.loadBalancer.balanceDue({
			cardId,
			originalDue: entry.due.toISOString(),
			maxShiftDays: this.settings.loadBalanceMaxShiftDays,
			easyDays: this.settings.easyDays,
			easyDaysMultiplier: this.settings.easyDaysMultiplier,
		});

		if (!result.balanced) {
			return {
				...entry,
				originalDue: entry.due,
				originalInterval: entry.interval,
				daysChanged: 0,
				loadBalanceNote:
					"No change: the FSRS day is already a good fit within the fuzz range.",
			};
		}

		const balancedDue = new Date(result.newDue);
		const balancedMinutes = (balancedDue.getTime() - Date.now()) / (1000 * 60);
		return {
			...entry,
			due: balancedDue,
			interval: formatInterval(balancedMinutes),
			originalDue: entry.due,
			balancedDue,
			originalInterval: entry.interval,
			daysChanged: result.daysChanged,
			loadBalanceNote:
				"Adjusted within the fuzz range to a less loaded day (Anki-style).",
		};
	}

	/**
	 * Scheduling parameters for rescheduling. Presets are the source of
	 * truth since optimization writes there; the flat fsrsWeights /
	 * fsrsRequestRetention fields are a stale legacy mirror kept as
	 * fallback for pre-preset settings files.
	 */
	private extractFSRSSettings(): FSRSSettings {
		const defaultPreset = this.settings.fsrsPresets?.find(
			(preset) => preset.id === this.settings.defaultPresetId,
		);
		return {
			requestRetention:
				defaultPreset?.requestRetention ?? this.settings.fsrsRequestRetention,
			maximumInterval:
				defaultPreset?.maximumInterval ?? this.settings.fsrsMaximumInterval,
			weights: defaultPreset?.weights ?? this.settings.fsrsWeights,
			enableFuzz: true,
			learningSteps: this.settings.learningSteps,
			relearningSteps: this.settings.relearningSteps,
			enableShortTerm: true,
		};
	}
}
