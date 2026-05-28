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
