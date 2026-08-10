import { UNASSIGNED_PATH } from "@true-recall/core/constants";
import type { ReviewOrder } from "@true-recall/core/types/settings.types";

export type CustomStudyCardState = "new" | "due" | "review" | "all";

export type CustomStudyRequest =
	| { kind: "increase-new"; amount: number }
	| { kind: "increase-review"; amount: number }
	| { kind: "forgotten"; days: number }
	| { kind: "actual-learning" }
	| { kind: "review-ahead"; days: number }
	| { kind: "preview-new"; days: number }
	| {
			kind: "state-or-tag";
			cardState: CustomStudyCardState;
			cardLimit: number;
			tagsToInclude: string[];
			tagsToExclude: string[];
	  };

/**
 * A persisted, materialized Custom Study queue.
 *
 * Like Anki's filtered deck, the query is retained for Rebuild while cardIds
 * is the exact queue snapshot currently "inside" the temporary deck.
 */
export interface TemporaryCustomStudyDeck {
	id: string;
	name: string;
	customStudy: CustomStudyRequest;
	cardIds: string[];
	sourceNoteFilters?: string[];
	projectPath?: string;
	scopeLabel?: string;
	createdAt: number;
	rebuiltAt: number;
}

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
	customStudy?: CustomStudyRequest;
	/** Exact ordered queue captured when a temporary filtered deck was built. */
	materializedCardIds?: string[];
	/** Identifies the persisted temporary deck owning this review session. */
	temporaryDeckId?: string;
	/** Session size for an R-Mode session. Absent means the due-date queue. */
	rModeTargetCount?: number;
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
	customStudy?: CustomStudyRequest;
	materializedCardIds?: string[];
	temporaryDeckId?: string;
	dayStartHour?: number;
	/** Session size for an R-Mode session. Absent means the due-date queue. */
	rModeTargetCount?: number;
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
		customStudy: state.customStudy,
		materializedCardIds: state.materializedCardIds,
		temporaryDeckId: state.temporaryDeckId,
		rModeTargetCount: state.rModeTargetCount,
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
		customStudy: filters.customStudy,
		materializedCardIds: filters.materializedCardIds,
		temporaryDeckId: filters.temporaryDeckId,
		rModeTargetCount: filters.rModeTargetCount,
	};
}

export function normalizeSessionFilters(
	filters: SessionFilters,
): SessionFilters {
	const normalized = { ...filters };

	// Strip virtual "__unassigned__" projectPath (not a real hierarchy node)
	if (normalized.projectPath === UNASSIGNED_PATH) {
		delete normalized.projectPath;
	}

	// Strip empty arrays
	if (normalized.sourceNoteFilters?.length === 0) {
		delete normalized.sourceNoteFilters;
	}

	// Strip empty strings
	if (normalized.sourceNoteFilter === "") delete normalized.sourceNoteFilter;
	if (normalized.sourceUidFilter === "") delete normalized.sourceUidFilter;
	if (normalized.filePathFilter === "") delete normalized.filePathFilter;
	if (normalized.projectPath === "") delete normalized.projectPath;

	return normalized;
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
		filters.studyAheadDays ||
		filters.customStudy ||
		filters.temporaryDeckId
	);
}

export function isPreviewCustomStudy(filters: SessionFilters): boolean {
	const request = filters.customStudy;
	if (!request) return filters.crammingMode === true;

	return (
		request.kind === "forgotten" ||
		request.kind === "preview-new" ||
		(request.kind === "state-or-tag" && request.cardState === "all")
	);
}
