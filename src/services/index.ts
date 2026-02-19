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

export { SqlJsAdapter } from "./ai/langchain-sqlite.adapter";
export { NLQueryService } from "./ai/nl-query.service";
export { type AuthResult, AuthService, type AuthState } from "./auth";
export {
	NoteStatusCacheService,
	ReactiveCache,
	type ReactiveCacheOptions,
} from "./cache";
export { DayBoundaryService } from "./core/day-boundary.service";
export {
	type FieldConfig,
	FrontmatterIndexService,
} from "./core/frontmatter-index.service";
export { FSRSService } from "./core/fsrs.service";
export { FSRSSimulatorService } from "./core/fsrs-simulator.service";
export {
	type DeviceDatabaseInfo,
	DeviceDiscoveryService,
	DeviceIdService,
} from "./device";
export { CardQueryService } from "./flashcard/card-query.service";
export { CardRepository } from "./flashcard/card-repository.service";
export {
	type CollectResult,
	CollectService,
} from "./flashcard/collect.service";
export {
	type DeletionHandlerDeps,
	DeletionHandlerService,
	type OrphanedCardsContext,
} from "./flashcard/deletion-handler.service";
export {
	type FlashcardInfo,
	FlashcardManager,
	type ScanResult,
} from "./flashcard/flashcard.service";
export { FlashcardParserService } from "./flashcard/flashcard-parser.service";
export { FrontmatterService } from "./flashcard/frontmatter.service";
export {
	type OrphanedCardGroup,
	type OrphanedCardInfo,
	OrphanedCardsService,
	type OrphanReason,
} from "./flashcard/orphaned-cards.service";
export { SourceNoteService } from "./flashcard/source-note.service";
export {
	type BackgroundBackupConfig,
	BackgroundBackupManager,
	type BackupStatus,
} from "./persistence/background-backup.service";
export {
	type BackupInfo,
	BackupService,
	type PruneResult,
} from "./persistence/backup.service";
export { SessionPersistenceService } from "./persistence/session-persistence.service";
export { SqliteStoreService } from "./persistence/sqlite";
export {
	type QueueBuildOptions,
	ReviewService,
} from "./review/review.service";
export {
	type GlobalFlashcardStats,
	StatsService,
} from "./stats/stats.service";
export { StatsCalculatorService } from "./stats/stats-calculator.service";
export { type SyncOptions, type SyncResult, SyncService } from "./sync";
export {
	getNotificationService,
	NOTIFICATION_DURATION,
	NotificationService,
	notify,
} from "./ui/notification.service";
export {
	type BatchCreateUndoPayload,
	type CreateUndoPayload,
	type DeleteUndoPayload,
	type UndoActionType,
	type UndoEntry,
	type UndoPayload,
	UndoService,
	type UpdateUndoPayload,
} from "./undo";
