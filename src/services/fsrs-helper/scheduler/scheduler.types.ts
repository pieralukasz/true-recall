/**
 * Types for FSRS Helper scheduler services
 */

import type { EasyDaysConfig } from "../../../types";

/**
 * Card due information for scheduling operations
 */
export interface CardDueInfo {
	/** Card ID */
	id: string;
	/** Current due date (ISO string) */
	due: string;
	/** Current scheduled interval in days */
	scheduledDays: number;
	/** Source note UID (for sibling detection) */
	sourceUid?: string;
}

/**
 * Distribution entry for workload visualization
 */
export interface WorkloadDistribution {
	/** Date (ISO date string YYYY-MM-DD) */
	date: string;
	/** Number of cards due on this date */
	count: number;
}

/**
 * Result of a scheduling operation
 */
export interface SchedulingResult {
	/** Number of cards affected */
	affectedCount: number;
	/** Distribution before the operation */
	beforeDistribution: WorkloadDistribution[];
	/** Distribution after the operation */
	afterDistribution: WorkloadDistribution[];
	/** Individual card changes (for preview/undo) */
	changes: CardScheduleChange[];
}

/**
 * Individual card schedule change
 */
export interface CardScheduleChange {
	/** Card ID */
	cardId: string;
	/** Original due date */
	originalDue: string;
	/** New due date */
	newDue: string;
	/** Change in days (positive = postponed, negative = advanced) */
	daysChanged: number;
}

/**
 * Options for load balancing
 */
export interface LoadBalanceOptions {
	/** Target number of reviews per day */
	targetPerDay: number;
	/** Maximum deviation from target (percentage) */
	maxDeviation: number;
	/** Days to balance (default 30) */
	days?: number;
	/** Easy days configuration */
	easyDays?: EasyDaysConfig;
	/** Multiplier for easy days (0.0-1.0) */
	easyDaysMultiplier?: number;
	/** Dry run - don't apply changes */
	dryRun?: boolean;
}

/**
 * Options for postpone/advance operations
 */
export interface ShiftOptions {
	/** Action to perform */
	action: "postpone" | "advance";
	/** Number of days to shift */
	days: number;
	/** Scope of cards to affect */
	scope: "all" | "due_today" | "overdue" | "selected";
	/** Specific card IDs (for scope="selected") */
	cardIds?: string[];
	/** Dry run - don't apply changes */
	dryRun?: boolean;
}

/**
 * Options for flattening
 */
export interface FlattenOptions {
	/** Target date to flatten */
	date: string;
	/** Maximum cards for the date */
	maxCards: number;
	/** Dry run - don't apply changes */
	dryRun?: boolean;
}

/**
 * Options for sibling dispersal
 */
export interface DisperseOptions {
	/** Minimum days between siblings */
	minInterval: number;
	/** Source UID to disperse (optional - if not provided, disperse all) */
	sourceUid?: string;
	/** Dry run - don't apply changes */
	dryRun?: boolean;
}

/**
 * Options for rescheduling
 */
export interface RescheduleOptions {
	/** Scope of cards to reschedule */
	scope: "all" | "due" | "overdue" | "selected";
	/** Specific card IDs (for scope="selected") */
	cardIds?: string[];
	/** Use new weights for calculation */
	useNewWeights?: boolean;
	/** Dry run - don't apply changes */
	dryRun?: boolean;
}

/**
 * Options for break scheduling
 */
export interface BreakScheduleOptions {
	/** Break start date (ISO date string) */
	startDate: string;
	/** Break end date (ISO date string) */
	endDate: string;
	/** Redistribute reviews before the break */
	redistributeBefore?: boolean;
	/** Redistribute reviews after the break */
	redistributeAfter?: boolean;
	/** Dry run - don't apply changes */
	dryRun?: boolean;
}
