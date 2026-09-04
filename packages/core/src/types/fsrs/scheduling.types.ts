import type { Grade } from "./card.types";

export interface SchedulingPreviewEntry {
	/** Final due date that will be applied if this rating is chosen. */
	due: Date;
	/** Final interval label, e.g. "<1m", "10m", "1d". */
	interval: string;
	/** Raw FSRS due date before load balancing, if balancing adjusted it. */
	originalDue?: Date;
	/** Load-balanced due date, if balancing adjusted it. */
	balancedDue?: Date;
	/** Interval label for the raw FSRS due date, if balancing adjusted it. */
	originalInterval?: string;
	/** Day delta from raw FSRS due date to load-balanced due date. */
	daysChanged?: number;
	/** Human-readable load balance status for hover details. */
	loadBalanceNote?: string;
}

export interface SchedulingPreview {
	again: SchedulingPreviewEntry;
	hard: SchedulingPreviewEntry;
	good: SchedulingPreviewEntry;
	easy: SchedulingPreviewEntry;
}

/**
 * Preview keys in ascending rating order. Anything that has to keep the
 * rating buttons monotonic (load balancing in particular) walks this order.
 */
export const PREVIEW_RATING_ORDER = [
	"again",
	"hard",
	"good",
	"easy",
] as const satisfies readonly (keyof SchedulingPreview)[];

export type SchedulingPreviewRating = (typeof PREVIEW_RATING_ORDER)[number];

const GRADE_TO_PREVIEW_RATING: Record<Grade, SchedulingPreviewRating> = {
	1: "again",
	2: "hard",
	3: "good",
	4: "easy",
};

/** Preview key an FSRS grade maps to (Again=1, Hard=2, Good=3, Easy=4). */
export function previewRatingFromGrade(grade: Grade): SchedulingPreviewRating {
	return GRADE_TO_PREVIEW_RATING[grade];
}

export interface HistoryValidationResult {
	isValid: boolean;
	totalReviews: number;
	totalCards: number;
	message: string;
	warnings: string[];
}

export interface OptimizationOptions {
	searchQuery?: string;
	minReviews?: number;
	excludeFirstDays?: number;
}

export interface OptimizationResult {
	success: boolean;
	weights: number[];
	reviewCount: number;
	message: string;
}
