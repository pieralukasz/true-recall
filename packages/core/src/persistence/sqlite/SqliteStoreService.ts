/**
 * High-performance storage for FSRS card data using sql.js.
 * Uses domain modules: store.cards.*, store.stats.*
 */

import type { IPersistence } from "../../interfaces/persistence";
import { IntegrityCheckService } from "../../services/maintenance/integrity-check.service";
import type { CardSchedulingMeta, FSRSCardData } from "../../types";
import { NOTIFICATION_DURATION, notify } from "../notification";
import {
	type DbLoadOutcome,
	loadDbFileWithSalvage,
	writeDbFileAtomically,
} from "./atomic-db-file";
import { ensureFolder, getDeviceDbPath } from "./db-location";
import {
	AssistantTaskActions,
	AssistantThreadActions,
	CardActions,
	NoteActions,
	NoteTypeActions,
	StatsActions,
} from "./modules";
import { CloudSyncDeferredActions } from "./modules/CloudSyncDeferredActions";
import { SqliteDatabase } from "./SqliteDatabase";
import { SqliteSchemaManager } from "./SqliteSchemaManager";
import {
	DB_FOLDER,
	SAVE_DEBOUNCE_MS,
	toExactArrayBuffer,
	VACUUM_MIN_FREE_BYTES,
	VACUUM_MIN_FREE_RATIO,
} from "./sqlite.types";

export interface SqliteStoreOptions {
	/** Debounce between the last write and the disk flush (default 5000 ms). */
	saveDebounceMs?: number;
	/** Folder holding the device database file (default `.true-recall`). */
	dbFolder?: string;
}

export class SqliteStoreService {
	private static readonly FOLLOW_UP_FLUSH_MS = 250;

	private persistence: IPersistence;
	private deviceId: string;
	private dbFolder: string;
	private saveDebounceMs: number;
	private db: SqliteDatabase;
	private isLoaded = false;
	private isDirty = false;
	private persistenceHalted = false;
	private saveTimer: number | null = null;
	private flushPromise: Promise<boolean> | null = null;
	private suppressRetryScheduling = false;
	private lastFlushStartedAt: number | null = null;
	private lastFlushSucceededAt: number | null = null;
	private lastFlushFailedAt: number | null = null;
	private lastFlushError: string | null = null;

	// Domain modules - public for direct access
	public readonly cards: CardActions;
	public readonly stats: StatsActions;
	public readonly notes: NoteActions;
	public readonly noteTypes: NoteTypeActions;
	public readonly cloudSyncDeferred: CloudSyncDeferredActions;
	public readonly integrity: IntegrityCheckService;
	public readonly assistantTasks: AssistantTaskActions;
	public readonly assistantThreads: AssistantThreadActions;

	constructor(
		persistence: IPersistence,
		deviceId: string,
		options: SqliteStoreOptions = {},
	) {
		this.persistence = persistence;
		this.deviceId = deviceId;
		this.saveDebounceMs = options.saveDebounceMs ?? SAVE_DEBOUNCE_MS;
		this.dbFolder = options.dbFolder ?? DB_FOLDER;
		this.db = new SqliteDatabase(() => this.markDirty());

		this.cards = new CardActions(this.db);
		this.stats = new StatsActions(this.db);
		this.notes = new NoteActions(this.db);
		this.noteTypes = new NoteTypeActions(this.db);
		this.cloudSyncDeferred = new CloudSyncDeferredActions(this.db);
		this.integrity = new IntegrityCheckService(this.db);
		this.assistantTasks = new AssistantTaskActions(this.db);
		this.assistantThreads = new AssistantThreadActions(this.db);
	}

	getSqliteDb(): SqliteDatabase {
		return this.db;
	}

	getDeviceId(): string {
		return this.deviceId;
	}

	async load(): Promise<void> {
		if (this.isLoaded) return;

		const dbPath = this.getDbPath();

		// Try candidates newest-first (.tmp → main → .bak) so an interrupted
		// flush never silently reverts the user to an old archived backup.
		let outcome: DbLoadOutcome;
		try {
			outcome = await loadDbFileWithSalvage(
				this.persistence,
				dbPath,
				async (bytes) => {
					await this.db.init(bytes);
					if (bytes) this.assertDbConsistent(bytes.byteLength);
				},
			);
		} catch (error) {
			// Every on-disk copy is unusable - CRITICAL ERROR
			console.error("[True Recall] Database load failed:", error);
			notify().error(
				"True Recall: Cannot load database. Please restore from backup (Settings → Data & Backup → Restore).",
				undefined,
				NOTIFICATION_DURATION.PERSIST, // Don't auto-hide
			);
			throw error; // Don't continue with empty database!
		}

		if (outcome.salvaged) {
			notify().warning(
				"True Recall: Main database file was damaged; recovered the newest intact copy and re-saving it now.",
				NOTIFICATION_DURATION.LONG,
			);
			// Rewrite the main file from the salvaged data as soon as possible.
			this.markDirty();
		}

		// Fix corrupted FKs before schema setup so createTables() indexes apply correctly
		this.cleanupStaleReferences();

		// Schema setup (CREATE TABLE IF NOT EXISTS — safe for existing DBs)
		const schemaManager = new SqliteSchemaManager(this.db.raw);
		schemaManager.createTables();
		if (outcome.source === "fresh") {
			this.isDirty = true;
		}

		this.integrity.checkAndRepairOnce();

		// Keep builtin note type templates in sync with code (idempotent, fixes stale DBs)
		this.noteTypes.refreshBuiltins();

		this.vacuumIfBloated();

		this.isLoaded = true;
	}

	/**
	 * Reclaim free pages left behind by bulk deletions. Saves export the
	 * in-memory DB verbatim — including free pages — so without VACUUM the
	 * file never shrinks and every load/save/backup pays for dead weight.
	 */
	private vacuumIfBloated(): void {
		try {
			const pageCount = this.pragmaNumber("page_count");
			const freeCount = this.pragmaNumber("freelist_count");
			const pageSize = this.pragmaNumber("page_size");
			if (pageCount <= 0 || pageSize <= 0) return;

			const freeBytes = freeCount * pageSize;
			if (
				freeBytes < VACUUM_MIN_FREE_BYTES ||
				freeCount / pageCount < VACUUM_MIN_FREE_RATIO
			) {
				return;
			}

			// run() marks the store dirty, so the shrunken DB persists on next flush
			this.db.run("VACUUM");

			const afterBytes = this.pragmaNumber("page_count") * pageSize;
			console.debug(
				`[True Recall] VACUUM reclaimed ${Math.round(
					(pageCount * pageSize - afterBytes) / 1024 / 1024,
				)}MB (${Math.round((pageCount * pageSize) / 1024 / 1024)}MB → ${Math.round(afterBytes / 1024 / 1024)}MB)`,
			);
		} catch (e) {
			console.warn("[True Recall] VACUUM failed:", e);
		}
	}

	private pragmaNumber(name: string): number {
		const row = this.db.query<Record<string, number>>(`PRAGMA ${name}`)[0];
		if (!row) return 0;
		return Number(Object.values(row)[0] ?? 0);
	}

	private cleanupStaleReferences(): void {
		try {
			// Every `run` dirties the store, and a dirty store rewrites the whole
			// database file after startup. Only touch the schema when the stale
			// table actually exists.
			const staleTable = this.db.get<{ name: string }>(
				`SELECT name FROM sqlite_master WHERE type='table' AND name='cards_old'`,
			);
			if (staleTable) {
				this.db.run(`DROP TABLE IF EXISTS cards_old`);
			}

			const triggers = this.db.query<{ name: string }>(
				`SELECT name FROM sqlite_master WHERE type='trigger' AND sql LIKE '%cards_old%'`,
			);
			for (const t of triggers) {
				this.db.run(`DROP TRIGGER IF EXISTS "${t.name}"`);
			}

			// Fix corrupted FKs — a prior migration renamed cards→cards_old,
			// and SQLite 3.25+ silently rewrote FKs in review_log to point at cards_old
			const corrupted = this.db.query<{ name: string; sql: string }>(
				`SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%cards_old%'`,
			);
			if (corrupted.length === 0) return;

			// PRAGMA foreign_keys must be set outside transactions (SQLite ignores it inside)
			this.db.run(`PRAGMA foreign_keys = OFF`);
			try {
				for (const table of corrupted) {
					this.recreateTableWithFixedFk(table.name, table.sql);
				}
			} finally {
				this.db.run(`PRAGMA foreign_keys = ON`);
			}
		} catch (e) {
			console.error("[True Recall] cleanupStaleReferences failed:", e);
		}
	}

	private recreateTableWithFixedFk(
		tableName: string,
		originalSql: string,
	): void {
		const fixedSql = originalSql.replace(/cards_old/g, "cards");
		const tempName = `${tableName}_fk_fix_temp`;

		this.db.transaction(() => {
			this.db.run(`ALTER TABLE "${tableName}" RENAME TO "${tempName}"`);
			this.db.run(fixedSql);

			const cols = this.db.query<{ name: string }>(
				`PRAGMA table_info("${tempName}")`,
			);
			const colNames = cols.map((c) => c.name).join(", ");
			this.db.run(
				`INSERT INTO "${tableName}" (${colNames}) SELECT ${colNames} FROM "${tempName}"`,
			);
			this.db.run(`DROP TABLE "${tempName}"`);
		});

		console.debug(`[True Recall] Fixed corrupted FK in table: ${tableName}`);
	}

	isReady(): boolean {
		return this.isLoaded && this.db.isReady();
	}

	get(cardId: string): FSRSCardData | undefined {
		return this.cards.get(cardId);
	}

	set(cardId: string, data: FSRSCardData): void {
		this.cards.set(cardId, data);
	}

	delete(cardId: string): void {
		this.cards.softDelete(cardId);
	}

	has(cardId: string): boolean {
		return this.cards.has(cardId);
	}

	keys(): string[] {
		return this.cards.keys();
	}

	getAll(): FSRSCardData[] {
		return this.cards.getAll();
	}

	getAllSchedulingMeta(): CardSchedulingMeta[] {
		return this.cards.getAllSchedulingMeta();
	}

	getSchedulingMetaById(cardId: string): CardSchedulingMeta | null {
		return this.cards.getSchedulingMetaById(cardId);
	}

	size(): number {
		return this.cards.size();
	}

	getByIds(cardIds: string[]): FSRSCardData[] {
		return this.cards.getByIds(cardIds);
	}

	getCardsWithContent(): FSRSCardData[] {
		return this.cards.getCardsWithContent();
	}

	getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
		return this.cards.getCardsBySourceUid(sourceUid);
	}

	getClozeSiblings(sourceUid: string, clozeTemplate: string): FSRSCardData[] {
		return this.cards.getClozeSiblings(sourceUid, clozeTemplate);
	}

	hasCardContent(cardId: string): boolean {
		return this.cards.hasCardContent(cardId);
	}

	hasAnyCardContent(): boolean {
		return this.cards.hasAnyCardContent();
	}

	getCardsWithContentCount(): number {
		return this.cards.getCardsWithContentCount();
	}

	async flush(): Promise<void> {
		await this.saveNow();
	}

	getDbPath(): string {
		return getDeviceDbPath(this.deviceId, this.dbFolder);
	}

	/**
	 * Reject files that deserialize but cannot hold their declared content,
	 * the signature of a truncated (torn-write) database file. The header
	 * page count is trusted by SQLite, so a mismatch with the actual byte
	 * length surfaces here deterministically instead of as random
	 * "database disk image is malformed" errors mid-session.
	 */
	private assertDbConsistent(actualByteLength: number): void {
		try {
			this.db.query("SELECT count(*) FROM sqlite_master");
			const declaredBytes =
				this.pragmaNumber("page_count") * this.pragmaNumber("page_size");
			if (declaredBytes > 0 && declaredBytes !== actualByteLength) {
				throw new Error(
					`Database size mismatch: header declares ${declaredBytes} bytes ` +
						`but file has ${actualByteLength} - truncated or corrupted file`,
				);
			}
		} catch (error) {
			this.db.close();
			throw error;
		}
	}

	private markDirty(): void {
		this.isDirty = true;
		this.scheduleSave();
	}

	private scheduleSave(): void {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
		}

		this.saveTimer = window.setTimeout(() => {
			void this.doFlush();
		}, this.saveDebounceMs);
	}

	private scheduleFollowUpFlush(): void {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
		}
		this.saveTimer = window.setTimeout(() => {
			void this.doFlush();
		}, SqliteStoreService.FOLLOW_UP_FLUSH_MS);
	}

	/**
	 * Permanently stop writing the in-memory database to disk (until reload).
	 * Used after restore-from-backup: without this, the next debounced flush
	 * would export the pre-restore in-memory DB over the restored file.
	 */
	haltPersistence(): void {
		this.persistenceHalted = true;
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
	}

	private async runFlushPass(
		scheduleRetryOnFailure: boolean,
	): Promise<boolean> {
		if (this.persistenceHalted) return true; // Restore pending — never write
		if (!this.db.isReady() || !this.isDirty) return true; // Nothing to save = success

		const MAX_RETRIES = 3;
		const BASE_DELAY_MS = 100;
		this.lastFlushStartedAt = Date.now();

		try {
			for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
				try {
					// Mark current changes as "being flushed". New writes during IO will flip isDirty=true.
					this.isDirty = false;
					const data = this.db.export();
					const dbPath = this.getDbPath();

					await ensureFolder(this.persistence, this.dbFolder);

					// Crash-safe swap: an interrupted write can never truncate the
					// main file (the cause of a full-day data loss on 2026-08-18).
					await writeDbFileAtomically(
						this.persistence,
						dbPath,
						toExactArrayBuffer(data),
					);

					this.lastFlushSucceededAt = Date.now();
					this.lastFlushError = null;
					// If writes happened during save, flush again quickly.
					if (this.isDirty) {
						this.scheduleFollowUpFlush();
					}
					return true; // Success
				} catch (error) {
					// Preserve unsaved state on any write/export failure.
					this.isDirty = true;
					this.lastFlushFailedAt = Date.now();
					this.lastFlushError =
						error instanceof Error ? error.message : String(error);
					console.error(
						`[True Recall] Failed to save database (attempt ${attempt}/${MAX_RETRIES}):`,
						error,
					);

					if (attempt < MAX_RETRIES) {
						// Exponential backoff: 100ms, 200ms, 400ms...
						const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
						await new Promise((resolve) => window.setTimeout(resolve, delay));
					} else {
						// Final failure - notify user, keep isDirty=true for retry
						notify().error(
							"Failed to save database after multiple attempts. Your recent changes may not be saved.",
							NOTIFICATION_DURATION.LONG,
						);
						if (scheduleRetryOnFailure && !this.suppressRetryScheduling) {
							this.scheduleSave();
						}
						return false; // Caller can react to failure
					}
				}
			}
		} catch (error) {
			this.lastFlushFailedAt = Date.now();
			this.lastFlushError =
				error instanceof Error ? error.message : String(error);
		}
		return false; // Should not reach here
	}

	private async doFlush(scheduleRetryOnFailure = true): Promise<boolean> {
		if (this.flushPromise) {
			return this.flushPromise;
		}

		this.flushPromise = this.runFlushPass(scheduleRetryOnFailure);
		try {
			return await this.flushPromise;
		} finally {
			this.flushPromise = null;
		}
	}

	async saveNow(options?: { bestEffort?: boolean }): Promise<boolean> {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}

		const bestEffort = options?.bestEffort ?? false;
		const previousSuppressRetry = this.suppressRetryScheduling;
		if (bestEffort) {
			this.suppressRetryScheduling = true;
		}

		try {
			// If a save is already running, wait for it to complete before deciding next step.
			if (this.flushPromise) {
				await this.flushPromise;
			}

			let success = true;
			while (this.isDirty) {
				const flushed = await this.doFlush(!bestEffort);
				success = success && flushed;
				if (!flushed && bestEffort) {
					break;
				}
				if (!flushed) {
					return false;
				}
			}

			return success;
		} finally {
			this.suppressRetryScheduling = previousSuppressRetry;
		}
	}

	async close(): Promise<void> {
		await this.saveNow();
		this.db.close();
		this.isLoaded = false;
	}

	transaction<T>(fn: () => T): T {
		return this.db.transaction(fn);
	}

	getStats(): {
		totalCards: number;
		totalReviews: number;
		dbSizeKB: number;
		isLoaded: boolean;
	} {
		if (!this.db.isReady()) {
			return { totalCards: 0, totalReviews: 0, dbSizeKB: 0, isLoaded: false };
		}

		const totalCards = this.size();
		const totalReviews = this.stats.getTotalReviewCount();
		const dbData = this.db.export();
		const dbSizeKB = Math.round(dbData.length / 1024);

		return {
			totalCards,
			totalReviews,
			dbSizeKB,
			isLoaded: this.isLoaded,
		};
	}

	getDatabase() {
		return this.db.raw;
	}

	getCards(): FSRSCardData[] {
		return this.cards.getAll();
	}

	getDueCardsByDateRange(startDate: string, endDate: string): FSRSCardData[] {
		return this.cards.getDueCardsByDateRange(startDate, endDate);
	}

	getDueCountsByDateRange(
		startDate: string,
		endDate: string,
		excludeCardId?: string,
	): { day: string; count: number }[] {
		return this.cards.getDueCountsByDateRange(
			startDate,
			endDate,
			excludeCardId,
		);
	}

	updateCardDue(cardId: string, newDue: string): void {
		this.cards.updateCardDue(cardId, newDue);
	}

	updateCardScheduling(
		cardId: string,
		data: { due: string; scheduledDays: number },
	): void {
		this.cards.updateCardScheduling(cardId, data);
	}

	getReviewDataForOptimization(presetName?: string) {
		return this.stats.getReviewDataForOptimization(presetName);
	}

	getReviewsForRetention(
		startDate: string,
		endDate: string,
		presetNames?: string[],
	) {
		return this.stats.getReviewsForRetention(startDate, endDate, presetNames);
	}

	getPersistenceDebugInfo(): {
		dbPath: string;
		isDirty: boolean;
		saveTimerActive: boolean;
		flushInProgress: boolean;
		lastFlushStartedAt: number | null;
		lastFlushSucceededAt: number | null;
		lastFlushFailedAt: number | null;
		lastFlushError: string | null;
	} {
		return {
			dbPath: this.getDbPath(),
			isDirty: this.isDirty,
			saveTimerActive: this.saveTimer !== null,
			flushInProgress: this.flushPromise !== null,
			lastFlushStartedAt: this.lastFlushStartedAt,
			lastFlushSucceededAt: this.lastFlushSucceededAt,
			lastFlushFailedAt: this.lastFlushFailedAt,
			lastFlushError: this.lastFlushError,
		};
	}
}
