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
    GeneratedNoteType,
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
} from "./settings.types";
export { extractFSRSSettings } from "./settings.types";

// FSRS types (from ./fsrs subdirectory)
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
    ExtendedDailyStats,
    CardMaturityBreakdown,
    FutureDueEntry,
    CardsCreatedEntry,
    CardsCreatedVsReviewedEntry,
    TodaySummary,
    StreakInfo,
    StatsTimeRange,
    RetentionEntry,
    CardStore,
    FSRSCard,
    ProjectInfo,
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
    ImageInsertOptions,
    ImageExtension,
    VideoExtension,
    MediaExtension,
} from "./image.types";
export {
    IMAGE_EXTENSIONS,
    isImageExtension,
    MAX_IMAGE_SIZE_BYTES,
    VIDEO_EXTENSIONS,
    isVideoExtension,
    MAX_VIDEO_SIZE_BYTES,
    MEDIA_EXTENSIONS,
    isMediaExtension,
} from "./image.types";

// NL Query types
export type {
    NLQueryResult,
    NLQueryStep,
    NLQueryConfig,
    ExampleQuery,
    ProblemCard,
    StudyPattern,
    TimeToMasteryStats,
} from "./nl-query.types";

// Sync types
export type {
    SyncResult,
    SyncOptions,
    FirstSyncStatus,
} from "./sync.types";
