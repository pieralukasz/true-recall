/**
 * High-performance storage for FSRS card data using sql.js.
 * Uses domain modules: store.cards.*, store.stats.*
 */
import { __awaiter } from "tslib";
import { IntegrityCheckService } from "../../services/maintenance/integrity-check.service";
import { NOTIFICATION_DURATION, notify } from "../notification";
import { CardActions, NoteActions, NoteTypeActions, StatsActions, } from "./modules";
import { SqliteDatabase } from "./SqliteDatabase";
import { SqliteSchemaManager } from "./SqliteSchemaManager";
import { DB_FOLDER, getDeviceDbFilename, SAVE_DEBOUNCE_MS, toExactArrayBuffer, } from "./sqlite.types";
export class SqliteStoreService {
    constructor(persistence, deviceId) {
        this.isLoaded = false;
        this.isDirty = false;
        this.saveTimer = null;
        this.flushPromise = null;
        this.suppressRetryScheduling = false;
        this.lastFlushStartedAt = null;
        this.lastFlushSucceededAt = null;
        this.lastFlushFailedAt = null;
        this.lastFlushError = null;
        this.persistence = persistence;
        this.deviceId = deviceId;
        this.db = new SqliteDatabase(() => this.markDirty());
        this.cards = new CardActions(this.db);
        this.stats = new StatsActions(this.db);
        this.notes = new NoteActions(this.db);
        this.noteTypes = new NoteTypeActions(this.db);
        this.integrity = new IntegrityCheckService(this.db);
    }
    getSqliteDb() {
        return this.db;
    }
    getDeviceId() {
        return this.deviceId;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isLoaded)
                return;
            const dbPath = this.getDbPath();
            // Load existing data - errors are now thrown instead of returning null
            let existingData = null;
            try {
                existingData = yield this.loadFromFile(dbPath);
            }
            catch (error) {
                // File exists but cannot be read - CRITICAL ERROR
                console.error("[True Recall] Database load failed:", error);
                notify().error("True Recall: Cannot load database. Please restore from backup (Settings → Data & Backup → Restore).", undefined, NOTIFICATION_DURATION.PERSIST);
                throw error; // Don't continue with empty database!
            }
            yield this.db.init(existingData);
            // Fix corrupted FKs before schema setup so createTables() indexes apply correctly
            this.cleanupStaleReferences();
            // Schema setup (CREATE TABLE IF NOT EXISTS — safe for existing DBs)
            const schemaManager = new SqliteSchemaManager(this.db.raw);
            schemaManager.createTables();
            if (!existingData) {
                this.isDirty = true;
            }
            this.db.run("DELETE FROM meta WHERE key = 'integrity_checked'");
            this.integrity.checkAndRepairOnce();
            // Keep builtin note type templates in sync with code (idempotent, fixes stale DBs)
            this.noteTypes.refreshBuiltins();
            this.isLoaded = true;
        });
    }
    cleanupStaleReferences() {
        try {
            this.db.run(`DROP TABLE IF EXISTS cards_old`);
            const triggers = this.db.query(`SELECT name FROM sqlite_master WHERE type='trigger' AND sql LIKE '%cards_old%'`);
            for (const t of triggers) {
                this.db.run(`DROP TRIGGER IF EXISTS "${t.name}"`);
            }
            // Fix corrupted FKs — a prior migration renamed cards→cards_old,
            // and SQLite 3.25+ silently rewrote FKs in review_log to point at cards_old
            const corrupted = this.db.query(`SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%cards_old%'`);
            if (corrupted.length === 0)
                return;
            // PRAGMA foreign_keys must be set outside transactions (SQLite ignores it inside)
            this.db.run(`PRAGMA foreign_keys = OFF`);
            try {
                for (const table of corrupted) {
                    this.recreateTableWithFixedFk(table.name, table.sql);
                }
            }
            finally {
                this.db.run(`PRAGMA foreign_keys = ON`);
            }
        }
        catch (e) {
            console.error("[True Recall] cleanupStaleReferences failed:", e);
        }
    }
    recreateTableWithFixedFk(tableName, originalSql) {
        const fixedSql = originalSql.replace(/cards_old/g, "cards");
        const tempName = `${tableName}_fk_fix_temp`;
        this.db.transaction(() => {
            this.db.run(`ALTER TABLE "${tableName}" RENAME TO "${tempName}"`);
            this.db.run(fixedSql);
            const cols = this.db.query(`PRAGMA table_info("${tempName}")`);
            const colNames = cols.map((c) => c.name).join(", ");
            this.db.run(`INSERT INTO "${tableName}" (${colNames}) SELECT ${colNames} FROM "${tempName}"`);
            this.db.run(`DROP TABLE "${tempName}"`);
        });
        console.debug(`[True Recall] Fixed corrupted FK in table: ${tableName}`);
    }
    isReady() {
        return this.isLoaded && this.db.isReady();
    }
    get(cardId) {
        return this.cards.get(cardId);
    }
    set(cardId, data) {
        this.cards.set(cardId, data);
    }
    delete(cardId) {
        this.cards.softDelete(cardId);
    }
    has(cardId) {
        return this.cards.has(cardId);
    }
    keys() {
        return this.cards.keys();
    }
    getAll() {
        return this.cards.getAll();
    }
    getAllSchedulingMeta() {
        return this.cards.getAllSchedulingMeta();
    }
    getSchedulingMetaById(cardId) {
        return this.cards.getSchedulingMetaById(cardId);
    }
    size() {
        return this.cards.size();
    }
    getByIds(cardIds) {
        return this.cards.getByIds(cardIds);
    }
    getCardsWithContent() {
        return this.cards.getCardsWithContent();
    }
    getCardsBySourceUid(sourceUid) {
        return this.cards.getCardsBySourceUid(sourceUid);
    }
    getClozeSiblings(sourceUid, clozeTemplate) {
        return this.cards.getClozeSiblings(sourceUid, clozeTemplate);
    }
    hasCardContent(cardId) {
        return this.cards.hasCardContent(cardId);
    }
    hasAnyCardContent() {
        return this.cards.hasAnyCardContent();
    }
    getCardsWithContentCount() {
        return this.cards.getCardsWithContentCount();
    }
    flush() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveNow();
        });
    }
    getDbPath() {
        const filename = getDeviceDbFilename(this.deviceId);
        return `${DB_FOLDER}/${filename}`;
    }
    loadFromFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileExists = yield this.persistence.exists(path);
            if (!fileExists) {
                return null;
            }
            // File exists - read errors are CRITICAL (don't treat as "new database")
            try {
                const data = yield this.persistence.readBinary(path);
                if (!data) {
                    return null;
                }
                // Validate SQLite header: "SQLite format 3\0"
                if (data.byteLength < 100) {
                    throw new Error(`Database file too small (${data.byteLength} bytes) - likely corrupted`);
                }
                const header = new TextDecoder().decode(new Uint8Array(data).slice(0, 16));
                if (!header.startsWith("SQLite format 3")) {
                    throw new Error("Invalid SQLite header - file corrupted");
                }
                return new Uint8Array(data);
            }
            catch (error) {
                // DO NOT return null - this would create an empty database!
                console.error("[True Recall] CRITICAL: Failed to load existing database:", error);
                throw new Error(`Cannot load database: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    markDirty() {
        this.isDirty = true;
        this.scheduleSave();
    }
    scheduleSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            void this.doFlush();
        }, SAVE_DEBOUNCE_MS);
    }
    scheduleFollowUpFlush() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            void this.doFlush();
        }, SqliteStoreService.FOLLOW_UP_FLUSH_MS);
    }
    runFlushPass(scheduleRetryOnFailure) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.db.isReady() || !this.isDirty)
                return true; // Nothing to save = success
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
                        const folderExists = yield this.persistence.exists(DB_FOLDER);
                        if (!folderExists) {
                            yield this.persistence.mkdir(DB_FOLDER);
                        }
                        yield this.persistence.writeBinary(dbPath, toExactArrayBuffer(data));
                        this.lastFlushSucceededAt = Date.now();
                        this.lastFlushError = null;
                        // If writes happened during save, flush again quickly.
                        if (this.isDirty) {
                            this.scheduleFollowUpFlush();
                        }
                        return true; // Success
                    }
                    catch (error) {
                        // Preserve unsaved state on any write/export failure.
                        this.isDirty = true;
                        this.lastFlushFailedAt = Date.now();
                        this.lastFlushError =
                            error instanceof Error ? error.message : String(error);
                        console.error(`[True Recall] Failed to save database (attempt ${attempt}/${MAX_RETRIES}):`, error);
                        if (attempt < MAX_RETRIES) {
                            // Exponential backoff: 100ms, 200ms, 400ms...
                            const delay = BASE_DELAY_MS * Math.pow(2, (attempt - 1));
                            yield new Promise((resolve) => setTimeout(resolve, delay));
                        }
                        else {
                            // Final failure - notify user, keep isDirty=true for retry
                            notify().error("Failed to save database after multiple attempts. Your recent changes may not be saved.", NOTIFICATION_DURATION.LONG);
                            if (scheduleRetryOnFailure && !this.suppressRetryScheduling) {
                                this.scheduleSave();
                            }
                            return false; // Caller can react to failure
                        }
                    }
                }
            }
            catch (error) {
                this.lastFlushFailedAt = Date.now();
                this.lastFlushError =
                    error instanceof Error ? error.message : String(error);
            }
            return false; // Should not reach here
        });
    }
    doFlush() {
        return __awaiter(this, arguments, void 0, function* (scheduleRetryOnFailure = true) {
            if (this.flushPromise) {
                return this.flushPromise;
            }
            this.flushPromise = this.runFlushPass(scheduleRetryOnFailure);
            try {
                return yield this.flushPromise;
            }
            finally {
                this.flushPromise = null;
            }
        });
    }
    saveNow(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                this.saveTimer = null;
            }
            const bestEffort = (_a = options === null || options === void 0 ? void 0 : options.bestEffort) !== null && _a !== void 0 ? _a : false;
            const previousSuppressRetry = this.suppressRetryScheduling;
            if (bestEffort) {
                this.suppressRetryScheduling = true;
            }
            try {
                // If a save is already running, wait for it to complete before deciding next step.
                if (this.flushPromise) {
                    yield this.flushPromise;
                }
                let success = true;
                while (this.isDirty) {
                    const flushed = yield this.doFlush(!bestEffort);
                    success = success && flushed;
                    if (!flushed && bestEffort) {
                        break;
                    }
                    if (!flushed) {
                        return false;
                    }
                }
                return success;
            }
            finally {
                this.suppressRetryScheduling = previousSuppressRetry;
            }
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveNow();
            this.db.close();
            this.isLoaded = false;
        });
    }
    transaction(fn) {
        return this.db.transaction(fn);
    }
    getStats() {
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
    getCards() {
        return this.cards.getAll();
    }
    getDueCardsByDateRange(startDate, endDate) {
        return this.cards.getDueCardsByDateRange(startDate, endDate);
    }
    updateCardDue(cardId, newDue) {
        this.cards.updateCardDue(cardId, newDue);
    }
    updateCardScheduling(cardId, data) {
        this.cards.updateCardScheduling(cardId, data);
    }
    getReviewDataForOptimization(presetName) {
        return this.stats.getReviewDataForOptimization(presetName);
    }
    getReviewsForRetention(startDate, endDate, presetNames) {
        return this.stats.getReviewsForRetention(startDate, endDate, presetNames);
    }
    getPersistenceDebugInfo() {
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
SqliteStoreService.FOLLOW_UP_FLUSH_MS = 250;
