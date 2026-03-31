import { UNASSIGNED_PATH } from "@true-recall/core/constants";
export function filtersFromViewState(state) {
    if (!state)
        return {};
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
export function filtersToViewState(filters) {
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
export function normalizeSessionFilters(filters) {
    var _a;
    const normalized = Object.assign({}, filters);
    // Strip virtual "__unassigned__" projectPath (not a real hierarchy node)
    if (normalized.projectPath === UNASSIGNED_PATH) {
        delete normalized.projectPath;
    }
    // Strip empty arrays
    if (((_a = normalized.sourceNoteFilters) === null || _a === void 0 ? void 0 : _a.length) === 0) {
        delete normalized.sourceNoteFilters;
    }
    // Strip empty strings
    if (normalized.sourceNoteFilter === "")
        delete normalized.sourceNoteFilter;
    if (normalized.sourceUidFilter === "")
        delete normalized.sourceUidFilter;
    if (normalized.filePathFilter === "")
        delete normalized.filePathFilter;
    if (normalized.projectPath === "")
        delete normalized.projectPath;
    return normalized;
}
export function isCustomSession(filters) {
    return !!(filters.projectPath ||
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
        filters.studyAheadDays);
}
