/**
 * Central export point for all types
 */

// Flashcard types
export type {
    FlashcardItem,
    FlashcardChangeType,
    FlashcardChange,
    DiffResult,
    FlashcardInfo,
} from "./flashcard.types";

// API types
export type {
    ChatMessage,
    OpenRouterResponse,
    OpenRouterError,
    OpenRouterConfig,
    APIRequestConfig,
} from "./api.types";

// Settings types
export type { EpistemeSettings, FSRSSettings } from "./settings.types";
export { extractFSRSSettings } from "./settings.types";

// FSRS types
export type {
    CardReviewLogEntry,
    FSRSCardData,
    FSRSFlashcardItem,
    ReviewResult,
    ReviewHistoryEntry,
    ReviewSessionStats,
    ReviewSessionState,
    SchedulingPreview,
    HistoryValidationResult,
    OptimizationOptions,
    OptimizationResult,
    DailyStats,
    ReviewViewMode,
    PersistentDailyStats,
    PersistentStatsData,
    DeckInfo,
    ExtendedDailyStats,
    CardMaturityBreakdown,
    FutureDueEntry,
    TodaySummary,
    StreakInfo,
    StatsTimeRange,
} from "./fsrs.types";

export {
    createDefaultFSRSData,
    createDefaultSessionState,
    formatInterval,
    formatIntervalDays,
} from "./fsrs.types";

// Re-export enums as types (for isolatedModules compatibility)
export { State, Rating } from "ts-fsrs";
export type { Grade } from "ts-fsrs";
export type { FSRSCard } from "./fsrs.types";
