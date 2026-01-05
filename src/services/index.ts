/**
 * Central export for all services
 *
 * Services are organized by domain:
 * - core: Core business logic (FSRS, day boundaries)
 * - flashcard: Flashcard management (parsing, moving, frontmatter)
 * - persistence: Data storage (sharded store, session persistence)
 * - stats: Statistics and calculations
 * - review: Review session management
 * - ai: AI integration (OpenRouter)
 * - ui: UI-specific services
 */

// Core services
export { FSRSService } from "./core/fsrs.service";
export { DayBoundaryService } from "./core/day-boundary.service";

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

// Persistence services
export {
	ShardedStoreService,
	type ShardEntry,
} from "./persistence/sharded-store.service";
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

// UI services
export { BacklinksFilterService } from "./ui/backlinks-filter.service";
