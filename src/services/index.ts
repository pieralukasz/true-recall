/**
 * Central export for all services
 *
 * Services are organized by domain:
 * - core: Core business logic (FSRS, day boundaries)
 * - flashcard: Flashcard management (parsing, moving, frontmatter)
 * - persistence: Data storage (SQLite, session persistence)
 * - stats: Statistics and calculations
 * - review: Review session management
 * - ai: AI integration (NL Query)
 * - ui: UI-specific services
 */

export { FSRSService } from "./core/fsrs.service";
export { FSRSSimulatorService } from "./core/fsrs-simulator.service";
export { DayBoundaryService } from "./core/day-boundary.service";
export {
	EventBusService,
	getEventBus,
	resetEventBus,
} from "./core/event-bus.service";
export {
	FrontmatterIndexService,
	type FieldConfig,
} from "./core/frontmatter-index.service";

export {
	FlashcardManager,
	type FlashcardInfo,
	type ScanResult,
} from "./flashcard/flashcard.service";
export { CardRepository } from "./flashcard/card-repository.service";
export { CardQueryService } from "./flashcard/card-query.service";
export { FrontmatterService } from "./flashcard/frontmatter.service";
export { FlashcardParserService } from "./flashcard/flashcard-parser.service";
export { SourceNoteService } from "./flashcard/source-note.service";
export {
	OrphanedCardsService,
	type OrphanReason,
	type OrphanedCardInfo,
	type OrphanedCardGroup,
} from "./flashcard/orphaned-cards.service";
export {
	DeletionHandlerService,
	type DeletionHandlerDeps,
	type OrphanedCardsContext,
} from "./flashcard/deletion-handler.service";
export {
	CollectService,
	type CollectResult,
} from "./flashcard/collect.service";

export { SqliteStoreService } from "./persistence/sqlite";
export { SessionPersistenceService } from "./persistence/session-persistence.service";
export { BackupService, type BackupInfo, type PruneResult } from "./persistence/backup.service";
export {
	BackgroundBackupManager,
	type BackgroundBackupConfig,
	type BackupStatus,
} from "./persistence/background-backup.service";

export {
	StatsService,
	type GlobalFlashcardStats,
} from "./stats/stats.service";
export { StatsCalculatorService } from "./stats/stats-calculator.service";

export {
	ReviewService,
	type QueueBuildOptions,
} from "./review/review.service";

export { NLQueryService } from "./ai/nl-query.service";
export { SqlJsAdapter } from "./ai/langchain-sqlite.adapter";

export {
	NotificationService,
	notify,
	getNotificationService,
	NOTIFICATION_DURATION,
} from "./ui/notification.service";

export {
	DeviceIdService,
	DeviceDiscoveryService,
	type DeviceDatabaseInfo,
} from "./device";

export { AuthService, type AuthState, type AuthResult } from "./auth";

export { SyncService, type SyncResult, type SyncOptions } from "./sync";

export {
	UndoService,
	type UndoEntry,
	type UndoActionType,
	type UndoPayload,
	type CreateUndoPayload,
	type UpdateUndoPayload,
	type DeleteUndoPayload,
	type BatchCreateUndoPayload,
} from "./undo";

export { ReactiveCache, type ReactiveCacheOptions } from "./cache";
