import type { ReviewOrder } from "@shared/types/settings.types";

export interface ReviewViewState extends Record<string, unknown> {
	/** Project note path — scopes review to project members */
	projectPath?: string;
	/** Single source UID scope (note-level review) */
	sourceUidFilter?: string;
	// Custom session filters
	sourceNoteFilter?: string;
	sourceNoteFilters?: string[];
	filePathFilter?: string;
	createdTodayOnly?: boolean;
	createdThisWeek?: boolean;
	weakCardsOnly?: boolean;
	stateFilter?: "due" | "learning" | "new" | "buried";
	ignoreDailyLimits?: boolean;
	bypassScheduling?: boolean;
	// Advanced custom study filters
	difficultyRange?: { min: number; max: number };
	lapsesRange?: { min: number; max: number };
	stabilityRange?: { min: number; max: number };
	overdueOnly?: boolean;
	recentlyFailed?: boolean;
	cardLimit?: number;
	studyAheadDays?: number;
	reviewOrder?: ReviewOrder;
	crammingMode?: boolean;
}

export interface SessionFilters {
	projectPath?: string;
	sourceUidFilter?: string;
	sourceNoteFilter?: string;
	sourceNoteFilters?: string[];
	filePathFilter?: string;
	createdTodayOnly?: boolean;
	createdThisWeek?: boolean;
	weakCardsOnly?: boolean;
	stateFilter?: "due" | "learning" | "new" | "buried";
	ignoreDailyLimits?: boolean;
	bypassScheduling?: boolean;
	difficultyRange?: { min: number; max: number };
	lapsesRange?: { min: number; max: number };
	stabilityRange?: { min: number; max: number };
	overdueOnly?: boolean;
	recentlyFailed?: boolean;
	cardLimit?: number;
	studyAheadDays?: number;
	customReviewOrder?: ReviewOrder;
	crammingMode?: boolean;
}

export function filtersFromViewState(
	state: ReviewViewState | null,
): SessionFilters {
	if (!state) return {};
	return {
		projectPath: state.projectPath,
		sourceUidFilter: state.sourceUidFilter,
		sourceNoteFilter: state.sourceNoteFilter,
		sourceNoteFilters: state.sourceNoteFilters,
		filePathFilter: state.filePathFilter,
		createdTodayOnly: state.createdTodayOnly,
		createdThisWeek: state.createdThisWeek,
		weakCardsOnly: state.weakCardsOnly,
		stateFilter: state.stateFilter,
		ignoreDailyLimits: state.ignoreDailyLimits,
		bypassScheduling: state.bypassScheduling,
		difficultyRange: state.difficultyRange,
		lapsesRange: state.lapsesRange,
		stabilityRange: state.stabilityRange,
		overdueOnly: state.overdueOnly,
		recentlyFailed: state.recentlyFailed,
		cardLimit: state.cardLimit,
		studyAheadDays: state.studyAheadDays,
		customReviewOrder: state.reviewOrder,
		crammingMode: state.crammingMode,
	};
}

export function filtersToViewState(filters: SessionFilters): ReviewViewState {
	return {
		projectPath: filters.projectPath,
		sourceUidFilter: filters.sourceUidFilter,
		sourceNoteFilter: filters.sourceNoteFilter,
		sourceNoteFilters: filters.sourceNoteFilters,
		filePathFilter: filters.filePathFilter,
		createdTodayOnly: filters.createdTodayOnly,
		createdThisWeek: filters.createdThisWeek,
		weakCardsOnly: filters.weakCardsOnly,
		stateFilter: filters.stateFilter,
		ignoreDailyLimits: filters.ignoreDailyLimits,
		bypassScheduling: filters.bypassScheduling,
		difficultyRange: filters.difficultyRange,
		lapsesRange: filters.lapsesRange,
		stabilityRange: filters.stabilityRange,
		overdueOnly: filters.overdueOnly,
		recentlyFailed: filters.recentlyFailed,
		cardLimit: filters.cardLimit,
		studyAheadDays: filters.studyAheadDays,
		reviewOrder: filters.customReviewOrder,
		crammingMode: filters.crammingMode,
	};
}

export function isCustomSession(filters: SessionFilters): boolean {
	return !!(
		filters.projectPath ||
		filters.sourceUidFilter ||
		filters.sourceNoteFilter ||
		(filters.sourceNoteFilters && filters.sourceNoteFilters.length > 0) ||
		filters.filePathFilter ||
		filters.createdTodayOnly ||
		filters.createdThisWeek ||
		filters.weakCardsOnly ||
		filters.stateFilter ||
		filters.difficultyRange ||
		filters.lapsesRange ||
		filters.stabilityRange ||
		filters.overdueOnly ||
		filters.recentlyFailed ||
		filters.studyAheadDays
	);
}
