import { State } from "ts-fsrs";

import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";
import type {
	FSRSCardData,
	FSRSSettings,
	SchedulingPreview,
	SchedulingPreviewEntry,
	SchedulingPreviewRating,
	TrueRecallSettings,
} from "../../types";
import { formatInterval } from "../../types/fsrs/fsrs.utils";
import { PREVIEW_RATING_ORDER } from "../../types/fsrs/scheduling.types";
import { formatLocalDate, getTodayBoundary } from "../../utils";
import type {
	OptimizationInput,
	OptimizationOutput,
	OptimizerOptions,
} from "./optimizer/optimizer.types";
import { ParameterOptimizerService } from "./optimizer/parameter-optimizer.service";
import { moveDueOutOfBreaks } from "./scheduler/break-days";
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
	BalanceDueResult,
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
	type CatchUpProjection,
	computePaceStats,
	computeSuggestedTarget,
	computeTargetFloor,
	PACE_LOOKBACK_DAYS,
	projectCatchUp,
} from "./scheduler/target-suggestion";
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

/** Everything the daily-target picker needs to render a conscious choice */
export interface WorkloadDecision {
	/** Average upcoming dues per weighted day, backlog excluded */
	steadyStatePerDay: number;
	/** Overdue Review cards (due before today) */
	backlogSize: number;
	/** Pace below which the backlog grows */
	targetFloor: number;
	medianPace: number;
	p75Pace: number;
	activeDays: number;
	/** Median pace floored at the water line; forecast average when history is thin */
	suggestedTarget: number;
	/** True when the legacy forecast average filled in for thin pace history */
	usedPaceFallback: boolean;
	/** Catch-up projection at the effective target */
	catchUp: CatchUpProjection;
	/** Manual target when configured, otherwise suggestedTarget */
	effectiveTarget: number;
}

/** Where an answered rating sits among the buttons the user was shown */
export interface RatingOrderContext {
	/** Rating that produced the answered card */
	rating: SchedulingPreviewRating;
	/** Raw FSRS preview of the pre-answer card, used only as order floors */
	rawPreview: SchedulingPreview;
}

const MINUTES_PER_DAY = 60 * 24;

const SKIPPED_NOTE =
	"Skipped: load balancing only adjusts review intervals of at least 1 day.";
const UNCHANGED_NOTE =
	"No change: the FSRS day is already a good fit within the fuzz range.";
const ADJUSTED_NOTE =
	"Adjusted within the fuzz range to a less loaded day (Anki-style).";
const BREAK_NOTE = "Moved out of a scheduled break.";

function minutesUntil(due: Date | string): number {
	return (new Date(due).getTime() - Date.now()) / (1000 * 60);
}

/** Fold a balancer result back into the preview entry the UI renders */
function describeBalancedEntry(
	entry: SchedulingPreviewEntry,
	result: BalanceDueResult | undefined,
): SchedulingPreviewEntry {
	const unchanged = {
		...entry,
		originalDue: entry.due,
		originalInterval: entry.interval,
		daysChanged: 0,
	};
	if (minutesUntil(entry.due) < MINUTES_PER_DAY) {
		return { ...unchanged, loadBalanceNote: SKIPPED_NOTE };
	}
	if (!result?.balanced) {
		return { ...unchanged, loadBalanceNote: UNCHANGED_NOTE };
	}

	const balancedDue = new Date(result.newDue);
	return {
		...unchanged,
		due: balancedDue,
		interval: formatInterval(minutesUntil(balancedDue)),
		balancedDue,
		daysChanged: result.daysChanged,
		loadBalanceNote: ADJUSTED_NOTE,
	};
}

/** Fold a scheduled-break shift into an already (maybe) balanced preview entry */
function describeBreakShiftedEntry(
	entry: SchedulingPreviewEntry,
	breaks: TrueRecallSettings["scheduledBreaks"],
): SchedulingPreviewEntry {
	if (minutesUntil(entry.due) < MINUTES_PER_DAY) return entry;
	const shift = moveDueOutOfBreaks(
		entry.due.toISOString(),
		breaks,
		utcDayKey(new Date()),
	);
	if (!shift) return entry;

	const shiftedDue = new Date(shift.newDue);
	return {
		...entry,
		due: shiftedDue,
		interval: formatInterval(minutesUntil(shiftedDue)),
		originalDue: entry.originalDue ?? entry.due,
		originalInterval: entry.originalInterval ?? entry.interval,
		balancedDue: shiftedDue,
		daysChanged: (entry.daysChanged ?? 0) + shift.daysChanged,
		loadBalanceNote: BREAK_NOTE,
	};
}

function utcDayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

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
			// null = the preset runs on FSRS defaults; only an omitted argument
			// falls back to the default preset (legacy mirror for old settings)
			currentWeights:
				(currentWeights === undefined
					? this.getDefaultPresetWeights()
					: currentWeights) ?? undefined,
			minReviews: 400,
		};

		return this.optimizer.optimize(input, options);
	}

	private getDefaultPresetWeights(): number[] | null {
		const defaultPreset = this.settings.fsrsPresets?.find(
			(preset) => preset.id === this.settings.defaultPresetId,
		);
		return defaultPreset ? defaultPreset.weights : this.settings.fsrsWeights;
	}

	validateWeights(weights: number[]): boolean {
		return this.optimizer.validateWeights(weights);
	}

	/** Manual target when configured, undefined in auto mode (suggestion derives it) */
	private resolveLoadBalanceTarget(): number | undefined {
		return this.settings.loadBalanceTargetMode === "manual"
			? this.settings.loadBalanceTarget
			: undefined;
	}

	/** The daily target actually in effect: manual value or the suggested target */
	getEffectiveLoadBalanceTarget(): number {
		return this.getWorkloadDecision().effectiveTarget;
	}

	/** Everything the daily-target picker needs to render a conscious choice */
	getWorkloadDecision(): WorkloadDecision {
		const steadyStatePerDay = this.loadBalancer.computeAutoTarget(
			this.settings.easyDays,
			this.settings.easyDaysMultiplier,
			false,
		);
		const backlogSize = this.loadBalancer.getBacklogSize();
		const pace = computePaceStats(this.getRecentDailyReviewCounts());
		const paceTarget = computeSuggestedTarget(
			pace,
			steadyStatePerDay,
			backlogSize,
		);
		const suggestedTarget =
			paceTarget ??
			this.loadBalancer.computeAutoTarget(
				this.settings.easyDays,
				this.settings.easyDaysMultiplier,
			);
		const effectiveTarget = this.resolveLoadBalanceTarget() ?? suggestedTarget;
		return {
			steadyStatePerDay,
			backlogSize,
			targetFloor: computeTargetFloor(steadyStatePerDay, backlogSize),
			medianPace: pace.medianPace,
			p75Pace: pace.p75Pace,
			activeDays: pace.activeDays,
			suggestedTarget,
			usedPaceFallback: paceTarget === null,
			catchUp: projectCatchUp(
				effectiveTarget,
				steadyStatePerDay,
				backlogSize,
				new Date(),
			),
			effectiveTarget,
		};
	}

	/** Reviews completed per active day over the pace lookback window */
	private getRecentDailyReviewCounts(): number[] {
		const end = new Date();
		const start = new Date(end);
		start.setDate(start.getDate() - PACE_LOOKBACK_DAYS);
		return this.cardStore.stats
			.getDailyStatsFromReviewLog(formatLocalDate(start), formatLocalDate(end))
			.map((day) => day.reviewsCompleted);
	}

	balanceWorkload(options?: Partial<LoadBalanceOptions>): SchedulingResult {
		const days = options?.days ?? this.settings.loadBalanceBulkDays;
		return this.loadBalancer.balance({
			targetPerDay:
				options?.targetPerDay ?? this.getEffectiveLoadBalanceTarget(),
			maxDeviation:
				options?.maxDeviation ?? this.settings.loadBalanceMaxDeviation,
			days: days === 0 ? 36500 : days,
			easyDays: options?.easyDays ?? this.settings.easyDays,
			easyDaysMultiplier:
				options?.easyDaysMultiplier ?? this.settings.easyDaysMultiplier,
			includeOverdue: options?.includeOverdue,
			cardIds: options?.cardIds,
			completedToday: options?.completedToday ?? this.getCompletedTodayCount(),
			scheduledBreaks: this.getScheduledBreaks(),
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

	/**
	 * Final due for an answered card: load-balanced, then moved out of any
	 * saved scheduled break. Pass `order` so the shift is picked through the
	 * same ordered chain the rating buttons were previewed with; without it
	 * the rating is balanced in isolation and may end up before a lower
	 * rating's day.
	 */
	balanceScheduledReview(
		cardId: string,
		fsrs: FSRSCardData,
		order?: RatingOrderContext,
	): FSRSCardData {
		return this.avoidScheduledBreaks(
			this.loadBalanceScheduledReview(cardId, fsrs, order),
		);
	}

	private loadBalanceScheduledReview(
		cardId: string,
		fsrs: FSRSCardData,
		order?: RatingOrderContext,
	): FSRSCardData {
		if (!this.settings.loadBalanceEnabled || fsrs.state !== State.Review) {
			return fsrs;
		}
		if (fsrs.scheduledDays < 1) return fsrs;
		if (minutesUntil(fsrs.due) < MINUTES_PER_DAY) return fsrs;

		const result = order
			? this.balanceOrderedDue(cardId, fsrs.due, order)
			: this.loadBalancer.balanceDue({
					cardId,
					originalDue: fsrs.due,
					...this.loadBalanceTuning(),
				});

		if (!result.balanced) return fsrs;

		return {
			...fsrs,
			due: result.newDue,
			scheduledDays: Math.max(1, fsrs.scheduledDays + result.daysChanged),
		};
	}

	/**
	 * Saved breaks keep working after the one-time redistribution: a review
	 * that would come due inside one lands on the nearest day outside it.
	 * Same-day learning steps are left alone.
	 */
	private avoidScheduledBreaks(fsrs: FSRSCardData): FSRSCardData {
		if (minutesUntil(fsrs.due) < MINUTES_PER_DAY) return fsrs;
		const shift = moveDueOutOfBreaks(
			fsrs.due,
			this.getScheduledBreaks(),
			utcDayKey(new Date()),
		);
		if (!shift) return fsrs;
		return {
			...fsrs,
			due: shift.newDue,
			scheduledDays: Math.max(1, fsrs.scheduledDays + shift.daysChanged),
		};
	}

	private getScheduledBreaks(): TrueRecallSettings["scheduledBreaks"] {
		return this.settings.scheduledBreaks ?? [];
	}

	/**
	 * Balance every rating button of one card. Ratings are balanced in
	 * ascending order so a higher rating never gets an earlier due date than a
	 * lower one, which independent per-button balancing used to allow.
	 */
	balanceSchedulingPreview(
		cardId: string,
		preview: SchedulingPreview,
	): SchedulingPreview {
		const breaks = this.getScheduledBreaks();
		if (!this.settings.loadBalanceEnabled && breaks.length === 0) {
			return preview;
		}

		const results = this.settings.loadBalanceEnabled
			? this.loadBalancer.balanceDueSequence({
					cardId,
					originalDues: PREVIEW_RATING_ORDER.map((rating) =>
						preview[rating].due.toISOString(),
					),
					...this.loadBalanceTuning(),
				})
			: null;

		const balanced = { ...preview };
		PREVIEW_RATING_ORDER.forEach((rating, index) => {
			const entry = results
				? describeBalancedEntry(preview[rating], results[index])
				: preview[rating];
			balanced[rating] = describeBreakShiftedEntry(entry, breaks);
		});
		return balanced;
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

	/**
	 * Automatic sibling dispersal after a review (settings toggle "Enable
	 * sibling dispersal"). Only the reviewed note's siblings are read, so it
	 * stays cheap on the grading path. Returns no changes when the toggle is
	 * off or the card has no source note.
	 */
	disperseSiblingsAfterReview(
		card: { id: string; sourceUid?: string },
		updated: Pick<FSRSCardData, "due" | "state">,
		options?: { dryRun?: boolean },
	): SchedulingResult {
		// Day-based spacing only makes sense around a day-based interval; a
		// card back in (re)learning comes due again within minutes
		if (
			!this.settings.siblingDisperseEnabled ||
			!card.sourceUid ||
			updated.state !== State.Review
		) {
			return {
				affectedCount: 0,
				beforeDistribution: [],
				afterDistribution: [],
				changes: [],
			};
		}
		return this.siblingDisperse.disperseAround({
			cardId: card.id,
			sourceUid: card.sourceUid,
			anchorDue: updated.due,
			minInterval: this.settings.siblingMinInterval,
			dryRun: options?.dryRun ?? false,
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
			this.getTargetRetention(presetNames),
			days,
			presetNames,
		);
	}

	getTrueRetentionSnapshot(
		days: number = 30,
		presetNames?: string[],
	): TrueRetentionSnapshot {
		return this.trueRetention.getSummaryAndRolling(
			this.getTargetRetention(presetNames),
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

	/** Balancer tuning shared by the preview and the grading paths */
	private loadBalanceTuning(): {
		maxShiftDays: number;
		easyDays: TrueRecallSettings["easyDays"];
		easyDaysMultiplier: number;
		scheduledBreaks: TrueRecallSettings["scheduledBreaks"];
	} {
		return {
			maxShiftDays: this.settings.loadBalanceMaxShiftDays,
			easyDays: this.settings.easyDays,
			easyDaysMultiplier: this.settings.easyDaysMultiplier,
			scheduledBreaks: this.getScheduledBreaks(),
		};
	}

	/**
	 * Balance the answered rating through the chain of lower ratings, so the
	 * stored due matches the one its rating button showed. The lower ratings
	 * come from the raw preview and are only used as order floors; the answered
	 * rating uses its own authoritative due.
	 */
	private balanceOrderedDue(
		cardId: string,
		due: string,
		order: RatingOrderContext,
	): BalanceDueResult {
		const index = PREVIEW_RATING_ORDER.indexOf(order.rating);
		const originalDues = PREVIEW_RATING_ORDER.slice(0, index + 1).map(
			(rating, position) =>
				position === index ? due : order.rawPreview[rating].due.toISOString(),
		);

		const results = this.loadBalancer.balanceDueSequence({
			cardId,
			originalDues,
			...this.loadBalanceTuning(),
		});

		return (
			results[index] ?? {
				originalDue: due,
				newDue: due,
				daysChanged: 0,
				balanced: false,
			}
		);
	}

	/**
	 * Retention the reported true retention should be judged against: the one
	 * the scheduler actually aims for. When the stats are scoped to a single
	 * preset that preset's target is used, otherwise the default preset's.
	 * The flat fsrsRequestRetention field is a stale legacy mirror and only
	 * serves as fallback for pre-preset settings files.
	 */
	private getTargetRetention(presetNames?: string[]): number {
		const presets = this.settings.fsrsPresets ?? [];
		const scoped =
			presetNames?.length === 1
				? presets.find((preset) => preset.name === presetNames[0])
				: undefined;
		const preset =
			scoped ??
			presets.find((entry) => entry.id === this.settings.defaultPresetId);
		return preset?.requestRetention ?? this.settings.fsrsRequestRetention;
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
