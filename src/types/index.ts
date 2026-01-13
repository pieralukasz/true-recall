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
} from "./settings.types";
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
    RetentionEntry,
    SourceNoteInfo,
} from "./fsrs.types";

export {
    createDefaultFSRSData,
    createDefaultSessionState,
    formatInterval,
    formatIntervalDays,
} from "./fsrs.types";

// Card store interface
export type { CardStore } from "./fsrs.types";

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

// Re-export enums as types (for isolatedModules compatibility)
export { State, Rating } from "ts-fsrs";
export type { Grade } from "ts-fsrs";
export type { FSRSCard } from "./fsrs.types";

// Image Occlusion types
export type {
    RectShape,
    EllipseShape,
    PolygonShape,
    OcclusionShape,
    OcclusionItem,
    OcclusionMode,
    ImageOcclusionData,
    ImageOcclusionCardData,
    ImageOcclusionEditorResult,
} from "./image-occlusion.types";

export {
    isImageOcclusionCard,
    parseImageOcclusionData,
    serializeImageOcclusionData,
    createRectShape,
    generateOcclusionId,
    DEFAULT_OCCLUSION_COLOR,
    MIN_SHAPE_SIZE,
} from "./image-occlusion.types";
