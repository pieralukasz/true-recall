import type { State } from "ts-fsrs";

import type { EasyDaysConfig } from "../../../types";

export interface CardDueInfo {
	id: string;
	due: string;
	scheduledDays: number;
	sourceUid?: string;
	state?: State;
}

export interface SchedulerCardData extends CardDueInfo {
	state: State;
	stability: number;
	lastReview: string | null;
	suspended?: boolean;
	buriedUntil?: string;
}

/** Count of Review-state due cards on one UTC day (YYYY-MM-DD) */
export interface DueDayCount {
	day: string;
	count: number;
}

export interface SchedulerCardStore {
	get(cardId: string): SchedulerCardData | undefined;
	getCards(): SchedulerCardData[];
	getDueCardsByDateRange(startDate: string, endDate: string): CardDueInfo[];
	/**
	 * Aggregate variant of getDueCardsByDateRange for workload histograms:
	 * counts Review-state cards per UTC due day without materializing rows,
	 * so per-review hot paths can afford it.
	 */
	getDueCountsByDateRange(
		startDate: string,
		endDate: string,
		excludeCardId?: string,
	): DueDayCount[];
	updateCardDue(cardId: string, newDue: string): void;
	updateCardScheduling(
		cardId: string,
		data: { due: string; scheduledDays: number },
	): void;
}

export interface WorkloadDistribution {
	date: string;
	count: number;
}

export interface SchedulingResult {
	affectedCount: number;
	beforeDistribution: WorkloadDistribution[];
	afterDistribution: WorkloadDistribution[];
	changes: CardScheduleChange[];
}

export interface CardScheduleChange {
	cardId: string;
	originalDue: string;
	newDue: string;
	daysChanged: number;
}

export interface LoadBalanceOptions {
	/** Daily review target; omit to derive it from the forecast average */
	targetPerDay?: number;
	maxDeviation: number;
	days?: number;
	easyDays?: EasyDaysConfig;
	easyDaysMultiplier?: number;
	/** Treat overdue cards as due today and spread the backlog forward (default true) */
	includeOverdue?: boolean;
	/** Restrict which cards may be moved (e.g. one project); day capacity still counts all cards */
	cardIds?: string[];
	/** Reviews already done today — subtracted from today's remaining capacity */
	completedToday?: number;
	dryRun?: boolean;
}

export interface BalanceDueOptions {
	cardId: string;
	originalDue: string;
	/** Hard cap on the day shift; 0 disables per-review balancing */
	maxShiftDays: number;
	easyDays?: EasyDaysConfig;
	easyDaysMultiplier?: number;
	/**
	 * Earliest day offset from today the balanced due may land on. Raises the
	 * lower end of the candidate window so a balanced due can be kept at or
	 * after an already-chosen one.
	 */
	minIntervalDays?: number;
}

export interface BalanceDueSequenceOptions
	extends Omit<BalanceDueOptions, "originalDue" | "minIntervalDays"> {
	/** Candidate dues for the same card, in the order they must stay in */
	originalDues: string[];
}

export interface BalanceDueResult {
	originalDue: string;
	newDue: string;
	daysChanged: number;
	balanced: boolean;
}

export interface ShiftOptions {
	action: "postpone" | "advance";
	days: number;
	scope: "all" | "due_today" | "overdue" | "selected";
	cardIds?: string[];
	dryRun?: boolean;
}

export interface FlattenOptions {
	date: string;
	maxCards: number;
	/** Restrict to these cards (e.g. one project); omit for all cards */
	cardIds?: string[];
	dryRun?: boolean;
}

export interface FlattenFutureOptions {
	maxCards: number;
	/** How many days ahead to flatten (default 365) */
	days?: number;
	/** Restrict to these cards (e.g. one project); omit for all cards */
	cardIds?: string[];
	dryRun?: boolean;
}

export interface DisperseOptions {
	minInterval: number;
	sourceUid?: string;
	dryRun?: boolean;
}

export interface RescheduleOptions {
	scope: "all" | "due" | "overdue" | "selected";
	cardIds?: string[];
	useNewWeights?: boolean;
	dryRun?: boolean;
}

export interface BreakScheduleOptions {
	startDate: string;
	endDate: string;
	redistributeBefore?: boolean;
	redistributeAfter?: boolean;
	/** Restrict to these cards (e.g. one project); omit for all cards */
	cardIds?: string[];
	dryRun?: boolean;
}
