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
    NoteFlashcardType,
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
export type {
    EpistemeSettings,
    FSRSSettings,
    NewCardOrder,
    ReviewOrder,
    NewReviewMix,
    CustomSessionInterface,
} from "./settings.types";
export { extractFSRSSettings } from "./settings.types";

// FSRS types (from ./fsrs subdirectory)
export type {
    CardReviewLogEntry,
    FSRSCardData,
    FSRSFlashcardItem,
    SourceNoteInfo,
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
    RetentionEntry,
    CardStore,
    FSRSCard,
} from "./fsrs";

export {
    createDefaultFSRSData,
    createDefaultSessionState,
    formatInterval,
    formatIntervalDays,
} from "./fsrs";

// Event types
export type {
	FlashcardEventType,
	FlashcardEvent,
	CardAddedEvent,
	CardUpdatedEvent,
	CardRemovedEvent,
	CardReviewedEvent,
	BulkChangeEvent,
	StoreSyncedEvent,
	AnyFlashcardEvent,
	FlashcardEventListener,
} from "./events.types";

// Re-export ts-fsrs enums (for isolatedModules compatibility)
export { State, Rating } from "./fsrs";
export type { Grade } from "./fsrs";

// Image types
export type {
    CardImageRef,
    ImageInsertOptions,
    ImageExtension,
} from "./image.types";
export {
    IMAGE_EXTENSIONS,
    isImageExtension,
    MAX_IMAGE_SIZE_BYTES,
} from "./image.types";
