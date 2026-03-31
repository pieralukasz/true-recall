import type { State } from "ts-fsrs";
import type { EasyDaysConfig } from "../../../types";

export interface CardDueInfo {
	id: string;
	due: string;
	scheduledDays: number;
	sourceUid?: string;
}

export interface SchedulerCardData extends CardDueInfo {
	state: State;
	stability: number;
	lastReview: string | null;
	suspended?: boolean;
	buriedUntil?: string;
}

export interface SchedulerCardStore {
	get(cardId: string): SchedulerCardData | undefined;
	getCards(): SchedulerCardData[];
	getDueCardsByDateRange(startDate: string, endDate: string): CardDueInfo[];
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
	targetPerDay: number;
	maxDeviation: number;
	days?: number;
	easyDays?: EasyDaysConfig;
	easyDaysMultiplier?: number;
	dryRun?: boolean;
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
	dryRun?: boolean;
}
