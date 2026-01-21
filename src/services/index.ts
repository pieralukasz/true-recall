/**
 * Central export for all services
 *
 * Services are organized by domain:
 * - core: Core business logic (FSRS, day boundaries)
 * - flashcard: Flashcard management (parsing, moving, frontmatter)
 * - persistence: Data storage (SQLite, session persistence)
 * - stats: Statistics and calculations
 * - review: Review session management
 * - ai: AI integration (OpenRouter)
 * - ui: UI-specific services
 */

// Core services
export { FSRSService } from "./core/fsrs.service";
export { DayBoundaryService } from "./core/day-boundary.service";
export {
	EventBusService,
	getEventBus,
	resetEventBus,
} from "./core/event-bus.service";

// Flashcard services
export {
	FlashcardManager,
	type FlashcardInfo,
	type ScanResult,
} from "./flashcard/flashcard.service";
export { FrontmatterService } from "./flashcard/frontmatter.service";
export { FlashcardParserService } from "./flashcard/flashcard-parser.service";
export {
	CardMoverService,
	type ExtractedCardData,
} from "./flashcard/card-mover.service";
export { SourceNoteService } from "./flashcard/source-note.service";
export { OrphanedCardsService } from "./flashcard/orphaned-cards.service";
export {
	CardNavigationService,
	type OpenFileOptions,
} from "./flashcard/card-navigation.service";
export {
	CollectService,
	type CollectResult,
} from "./flashcard/collect.service";

// Persistence services
export { SqliteStoreService } from "./persistence/sqlite";
export { SessionPersistenceService } from "./persistence/session-persistence.service";

// Stats services
export {
	StatsService,
	type GlobalFlashcardStats,
} from "./stats/stats.service";
export { StatsCalculatorService } from "./stats/stats-calculator.service";

// Review services
export {
	ReviewService,
	type QueueBuildOptions,
} from "./review/review.service";

// AI services
export {
	OpenRouterService,
	type DiffResult,
} from "./ai/openrouter.service";
export { NLQueryService } from "./ai/nl-query.service";
export { SqlJsAdapter } from "./ai/langchain-sqlite.adapter";

// UI services
export {
	NotificationService,
	notify,
	getNotificationService,
	NOTIFICATION_DURATION,
} from "./ui/notification.service";
