import type { ReviewOrder } from "@true-recall/core/types/settings.types";
export interface ReviewViewState extends Record<string, unknown> {
    /** Project note path — scopes review to project members */
    projectPath?: string;
    /** Single source UID scope (note-level review) */
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
    difficultyRange?: {
        min: number;
        max: number;
    };
    lapsesRange?: {
        min: number;
        max: number;
    };
    stabilityRange?: {
        min: number;
        max: number;
    };
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
    difficultyRange?: {
        min: number;
        max: number;
    };
    lapsesRange?: {
        min: number;
        max: number;
    };
    stabilityRange?: {
        min: number;
        max: number;
    };
    overdueOnly?: boolean;
    recentlyFailed?: boolean;
    cardLimit?: number;
    studyAheadDays?: number;
    customReviewOrder?: ReviewOrder;
    crammingMode?: boolean;
    dayStartHour?: number;
}
export declare function filtersFromViewState(state: ReviewViewState | null): SessionFilters;
export declare function filtersToViewState(filters: SessionFilters): ReviewViewState;
export declare function normalizeSessionFilters(filters: SessionFilters): SessionFilters;
export declare function isCustomSession(filters: SessionFilters): boolean;
