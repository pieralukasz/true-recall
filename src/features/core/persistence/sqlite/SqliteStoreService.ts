/**
 * High-performance storage for FSRS card data using sql.js.
 * Uses domain modules: store.cards.*, store.stats.*
 */

import {
	CardActions,
	NoteActions,
	NoteTypeActions,
	StatsActions,
} from "@features/core/persistence/sqlite/modules";
import { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";
import { SqliteSchemaManager } from "@features/core/persistence/sqlite/SqliteSchemaManager";
import {
	DB_FOLDER,
	getDeviceDbFilename,
	SAVE_DEBOUNCE_MS,
	toExactArrayBuffer,
} from "@features/core/persistence/sqlite/sqlite.types";
import { IntegrityCheckService } from "@features/core/services/integrity-check.service";
import {
	NOTIFICATION_DURATION,
	notify,
} from "@shared/services/notification.service";
import type { FSRSCardData } from "@shared/types";
import { type App, normalizePath } from "obsidian";

export class SqliteStoreService {
	private static readonly FOLLOW_UP_FLUSH_MS = 250;

	private app: App;
	private deviceId: string;
	private db: SqliteDatabase;
	private isLoaded = false;
	private isDirty = false;
	private saveTimer: ReturnType<typeof setTimeout> | null = null;
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
	public readonly integrity: IntegrityCheckService;

	constructor(app: App, deviceId: string) {
		this.app = app;
		this.deviceId = deviceId;
		this.db = new SqliteDatabase(app, () => this.markDirty());

		// Initialize domain modules
		this.cards = new CardActions(this.db);
		this.stats = new StatsActions(this.db);
		this.notes = new NoteActions(this.db);
		this.noteTypes = new NoteTypeActions(this.db);
		this.integrity = new IntegrityCheckService(this.db);
	}

	getDeviceId(): string {
		return this.deviceId;
	}

	async load(): Promise<void> {
		if (this.isLoaded) return;

		const dbPath = this.getDbPath();

		// Load existing data - errors are now thrown instead of returning null
		let existingData: Uint8Array | null = null;
		try {
			existingData = await this.loadFromFile(dbPath);
		} catch (error) {
			// File exists but cannot be read - CRITICAL ERROR
			console.error("[True Recall] Database load failed:", error);
			notify().error(
				"True Recall: Cannot load database. Please restore from backup (Settings → Data & Backup → Restore).",
				undefined,
				NOTIFICATION_DURATION.PERSIST, // Don't auto-hide
			);
			throw error; // Don't continue with empty database!
		}

		// Initialize database with sql.js
		await this.db.init(existingData);

		// Fix corrupted FKs before schema setup so createTables() indexes apply correctly
		this.cleanupStaleReferences();

		// Schema setup (CREATE TABLE IF NOT EXISTS — safe for existing DBs)
		const schemaManager = new SqliteSchemaManager(this.db.raw);
		schemaManager.createTables();
		if (!existingData) {
			this.isDirty = true;
		}

		// Reset per-session flag so integrity check runs on each plugin load
		this.db.run("DELETE FROM meta WHERE key = 'integrity_checked'");
		this.integrity.checkAndRepairOnce();

		// Keep builtin note type templates in sync with code (idempotent, fixes stale DBs)
		this.noteTypes.refreshBuiltins();

		this.isLoaded = true;
	}

	private cleanupStaleReferences(): void {
		try {
			this.db.run(`DROP TABLE IF EXISTS cards_old`);

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

		console.log(`[True Recall] Fixed corrupted FK in table: ${tableName}`);
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
		// Wrapper maintains backward compatibility
		this.cards.delete(cardId);
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

	private getDbPath(): string {
		const filename = getDeviceDbFilename(this.deviceId);
		return normalizePath(`${DB_FOLDER}/${filename}`);
	}

	private async loadFromFile(path: string): Promise<Uint8Array | null> {
		const exists = await this.app.vault.adapter.exists(path);
		if (!exists) {
			return null;
		}

		// File exists - read errors are CRITICAL (don't treat as "new database")
		try {
			const data = await this.app.vault.adapter.readBinary(path);

			// Validate SQLite header: "SQLite format 3\0"
			if (data.byteLength < 100) {
				throw new Error(
					`Database file too small (${data.byteLength} bytes) - likely corrupted`,
				);
			}

			const header = new TextDecoder().decode(
				new Uint8Array(data).slice(0, 16),
			);
			if (!header.startsWith("SQLite format 3")) {
				throw new Error("Invalid SQLite header - file corrupted");
			}

			return new Uint8Array(data);
		} catch (error) {
			// DO NOT return null - this would create an empty database!
			console.error(
				"[True Recall] CRITICAL: Failed to load existing database:",
				error,
			);
			throw new Error(
				`Cannot load database: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private markDirty(): void {
		this.isDirty = true;
		this.scheduleSave();
	}

	private scheduleSave(): void {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}

		this.saveTimer = setTimeout(() => {
			void this.doFlush();
		}, SAVE_DEBOUNCE_MS);
	}

	private scheduleFollowUpFlush(): void {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}
		this.saveTimer = setTimeout(() => {
			void this.doFlush();
		}, SqliteStoreService.FOLLOW_UP_FLUSH_MS);
	}

	private async runFlushPass(scheduleRetryOnFailure: boolean): Promise<boolean> {
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

					const folderPath = normalizePath(DB_FOLDER);
					const folderExists = await this.app.vault.adapter.exists(folderPath);
					if (!folderExists) {
						await this.app.vault.adapter.mkdir(folderPath);
					}

					await this.app.vault.adapter.writeBinary(
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
						await new Promise((resolve) => setTimeout(resolve, delay));
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
			clearTimeout(this.saveTimer);
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

	async updateCardDue(cardId: string, newDue: string): Promise<void> {
		this.cards.updateCardDue(cardId, newDue);
	}

	async updateCardScheduling(
		cardId: string,
		data: { due: string; scheduledDays: number },
	): Promise<void> {
		this.cards.updateCardScheduling(cardId, data);
	}

	getReviewDataForOptimization(presetName?: string) {
		return this.stats.getReviewDataForOptimization(presetName);
	}

	getReviewsForRetention(startDate: string, endDate: string) {
		return this.stats.getReviewsForRetention(startDate, endDate);
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
