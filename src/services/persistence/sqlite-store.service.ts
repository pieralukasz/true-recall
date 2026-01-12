/**
 * SQLite Store Service
 * High-performance storage for FSRS card data using sql.js (SQLite WASM)
 */
import { App, normalizePath } from "obsidian";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type {
    FSRSCardData,
    CardReviewLogEntry,
    ExtendedDailyStats,
    StoreSyncedEvent,
    SourceNoteInfo,
} from "../../types";
import { State } from "ts-fsrs";
import { getEventBus } from "../core/event-bus.service";

const DB_FOLDER = ".episteme";
const DB_FILE = "episteme.db";
const SAVE_DEBOUNCE_MS = 1000;

// Type for SQL row values from sql.js
type SqlValue = string | number | null | Uint8Array;
type SqlRow = SqlValue[];

// Helper to safely extract query result data
interface SafeQueryResult {
    columns: string[];
    values: SqlRow[];
}

function getQueryResult(
    result: ReturnType<import("sql.js").Database["exec"]>
): SafeQueryResult | null {
    const firstResult = result[0];
    if (!firstResult || !firstResult.values || firstResult.values.length === 0) {
        return null;
    }
    return {
        columns: firstResult.columns,
        values: firstResult.values as SqlRow[],
    };
}

/**
 * SQLite-based storage service for FSRS card data
 *
 * Benefits:
 * - Single database file
 * - SQL queries for fast aggregations
 * - Transactions for atomic writes
 * - Indexes for O(log n) lookups
 */
export class SqliteStoreService {
    private app: App;
    private db: Database | null = null;
    private SQL: SqlJsStatic | null = null;
    private isLoaded = false;
    private isDirty = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private wasmPath: string;

    constructor(app: App, wasmPath?: string) {
        this.app = app;
        // Default: look for WASM in plugin folder
        this.wasmPath = wasmPath || "";
    }

    /**
     * Initialize the SQLite database
     * Loads existing database from file or creates new one
     */
    async load(): Promise<void> {
        if (this.isLoaded) return;

        // Initialize sql.js with WASM
        this.SQL = await initSqlJs({
            locateFile: (file: string) => {
                // Use CDN for WASM file (simplest approach)
                return `https://sql.js.org/dist/${file}`;
            },
        });

        // Try to load existing database
        const dbPath = this.getDbPath();
        const existingData = await this.loadFromFile(dbPath);

        if (existingData) {
            this.db = new this.SQL.Database(existingData);
            // Run migrations for existing databases
            this.runMigrations();
        } else {
            this.db = new this.SQL.Database();
            this.createTables();
            this.isDirty = true;
        }

        this.isLoaded = true;
    }

    /**
     * Check if database is ready
     */
    isReady(): boolean {
        return this.isLoaded && this.db !== null;
    }

    /**
     * Get database file path
     */
    private getDbPath(): string {
        return normalizePath(`${DB_FOLDER}/${DB_FILE}`);
    }

    /**
     * Load database from file
     */
    private async loadFromFile(path: string): Promise<Uint8Array | null> {
        try {
            const exists = await this.app.vault.adapter.exists(path);
            if (!exists) return null;

            const data = await this.app.vault.adapter.readBinary(path);
            return new Uint8Array(data);
        } catch (error) {
            console.warn("[Episteme] Failed to load database:", error);
            return null;
        }
    }

    /**
     * Create database tables (schema v3)
     * v3: Removed deck, source_note, file_path from cards (use source_notes table via JOIN)
     */
    private createTables(): void {
        if (!this.db) return;

        this.db.run(`
            -- Cards table with FSRS scheduling data + content (v3)
            -- deck/source_note/file_path removed - use source_notes via source_uid JOIN
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                due TEXT NOT NULL,
                stability REAL DEFAULT 0,
                difficulty REAL DEFAULT 0,
                reps INTEGER DEFAULT 0,
                lapses INTEGER DEFAULT 0,
                state INTEGER DEFAULT 0,
                last_review TEXT,
                scheduled_days INTEGER DEFAULT 0,
                learning_step INTEGER DEFAULT 0,
                suspended INTEGER DEFAULT 0,
                buried_until TEXT,
                created_at INTEGER,
                updated_at INTEGER,
                question TEXT,
                answer TEXT,
                source_uid TEXT,
                tags TEXT
            );

            -- Indexes for common queries
            CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
            CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
            CREATE INDEX IF NOT EXISTS idx_cards_suspended ON cards(suspended);
            CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid);

            -- Source notes table - links to Markdown source notes
            CREATE TABLE IF NOT EXISTS source_notes (
                uid TEXT PRIMARY KEY,
                note_name TEXT NOT NULL,
                note_path TEXT,
                deck TEXT DEFAULT 'Knowledge',
                created_at INTEGER,
                updated_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_source_notes_name ON source_notes(note_name);

            -- Review history log (like Anki's revlog)
            CREATE TABLE IF NOT EXISTS review_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id TEXT NOT NULL,
                reviewed_at TEXT NOT NULL,
                rating INTEGER NOT NULL,
                scheduled_days INTEGER,
                elapsed_days INTEGER,
                state INTEGER,
                time_spent_ms INTEGER,
                FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_revlog_card ON review_log(card_id);
            CREATE INDEX IF NOT EXISTS idx_revlog_date ON review_log(reviewed_at);

            -- Daily statistics
            CREATE TABLE IF NOT EXISTS daily_stats (
                date TEXT PRIMARY KEY,
                reviews_completed INTEGER DEFAULT 0,
                new_cards_studied INTEGER DEFAULT 0,
                total_time_ms INTEGER DEFAULT 0,
                again_count INTEGER DEFAULT 0,
                hard_count INTEGER DEFAULT 0,
                good_count INTEGER DEFAULT 0,
                easy_count INTEGER DEFAULT 0,
                new_cards INTEGER DEFAULT 0,
                learning_cards INTEGER DEFAULT 0,
                review_cards INTEGER DEFAULT 0
            );

            -- Reviewed card IDs per day (for daily limits)
            CREATE TABLE IF NOT EXISTS daily_reviewed_cards (
                date TEXT NOT NULL,
                card_id TEXT NOT NULL,
                PRIMARY KEY (date, card_id)
            );

            CREATE INDEX IF NOT EXISTS idx_daily_reviewed_date ON daily_reviewed_cards(date);

            -- Metadata
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            -- Set schema version (v3 - removed legacy columns)
            INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '3');
            INSERT OR REPLACE INTO meta (key, value) VALUES ('created_at', datetime('now'));
        `);
    }

    /**
     * Migrate database schema from v1 to v2
     * Adds: question, answer, source_uid, tags columns + source_notes table
     */
    private migrateSchemaV1toV2(): void {
        if (!this.db) return;

        console.log("[Episteme] Migrating database schema from v1 to v2...");

        try {
            // Add new columns to cards table (SQLite doesn't support IF NOT EXISTS for columns)
            // We'll catch errors if columns already exist
            const columnsToAdd = [
                "ALTER TABLE cards ADD COLUMN question TEXT",
                "ALTER TABLE cards ADD COLUMN answer TEXT",
                "ALTER TABLE cards ADD COLUMN source_uid TEXT",
                "ALTER TABLE cards ADD COLUMN tags TEXT",
            ];

            for (const sql of columnsToAdd) {
                try {
                    this.db.run(sql);
                } catch {
                    // Column might already exist, ignore
                }
            }

            // Create source_notes table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS source_notes (
                    uid TEXT PRIMARY KEY,
                    note_name TEXT NOT NULL,
                    note_path TEXT,
                    deck TEXT DEFAULT 'Knowledge',
                    created_at INTEGER,
                    updated_at INTEGER
                )
            `);

            // Create indexes
            try {
                this.db.run("CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_source_notes_name ON source_notes(note_name)");
            } catch {
                // Indexes might already exist
            }

            // Update schema version
            this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2')");

            console.log("[Episteme] Schema migration v1->v2 completed");
            this.markDirty();
        } catch (error) {
            console.error("[Episteme] Schema migration failed:", error);
        }
    }

    /**
     * Get current schema version
     */
    private getSchemaVersion(): number {
        if (!this.db) return 0;

        try {
            const result = this.db.exec("SELECT value FROM meta WHERE key = 'schema_version'");
            const data = getQueryResult(result);
            if (data && data.values.length > 0) {
                return parseInt(data.values[0]![0] as string, 10) || 1;
            }
        } catch {
            // meta table might not exist in very old databases
        }

        return 1; // Default to v1 if not found
    }

    /**
     * Check and run any needed schema migrations
     */
    private runMigrations(): void {
        const currentVersion = this.getSchemaVersion();

        if (currentVersion < 2) {
            this.migrateSchemaV1toV2();
        }

        // Future migrations can be added here:
        // if (currentVersion < 3) { this.migrateSchemaV2toV3(); }
    }

    // ===== Card CRUD Operations =====

    /**
     * Get a card by ID
     */
    get(cardId: string): FSRSCardData | undefined {
        if (!this.db) return undefined;

        const result = this.db.exec(
            `SELECT * FROM cards WHERE id = ?`,
            [cardId]
        );

        const data = getQueryResult(result);
        if (!data) return undefined;

        // Safe: getQueryResult guarantees values.length > 0
        return this.rowToFSRSCardData(data.columns, data.values[0]!);
    }

    /**
     * Set/update a card (schema v2 - includes content)
     */
    set(cardId: string, data: FSRSCardData): void {
        if (!this.db) return;

        const now = Date.now();
        const extended = data as FSRSCardDataExtended;

        this.db.run(`
            INSERT OR REPLACE INTO cards (
                id, due, stability, difficulty, reps, lapses, state,
                last_review, scheduled_days, learning_step, suspended,
                buried_until, deck, source_note, file_path, created_at, updated_at,
                question, answer, source_uid, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cardId,
            data.due,
            data.stability,
            data.difficulty,
            data.reps,
            data.lapses,
            data.state,
            data.lastReview,
            data.scheduledDays,
            data.learningStep,
            data.suspended ? 1 : 0,
            data.buriedUntil || null,
            extended.deck || "default",
            extended.sourceNoteName || null,
            extended.filePath || null,
            data.createdAt || now,
            now,
            // Schema v2 fields
            data.question || null,
            data.answer || null,
            data.sourceUid || null,
            data.tags ? JSON.stringify(data.tags) : null,
        ]);

        this.markDirty();
    }

    /**
     * Delete a card
     */
    delete(cardId: string): void {
        if (!this.db) return;

        this.db.run(`DELETE FROM cards WHERE id = ?`, [cardId]);
        this.markDirty();
    }

    /**
     * Check if a card exists
     */
    has(cardId: string): boolean {
        if (!this.db) return false;

        const result = this.db.exec(
            `SELECT 1 FROM cards WHERE id = ? LIMIT 1`,
            [cardId]
        );

        return getQueryResult(result) !== null;
    }

    /**
     * Get all card IDs
     */
    keys(): string[] {
        if (!this.db) return [];

        const result = this.db.exec(`SELECT id FROM cards`);
        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => row[0] as string);
    }

    /**
     * Get all cards
     */
    getAll(): FSRSCardData[] {
        if (!this.db) return [];

        const result = this.db.exec(`SELECT * FROM cards`);
        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) =>
            this.rowToFSRSCardData(data.columns, row)
        );
    }

    /**
     * Get total card count
     */
    size(): number {
        if (!this.db) return 0;

        const result = this.db.exec(`SELECT COUNT(*) FROM cards`);
        const data = getQueryResult(result);
        if (!data) return 0;

        return data.values[0]![0] as number;
    }

    // ===== Card Content Operations (Schema v2) =====

    /**
     * Update only card content (question/answer) without touching FSRS data
     */
    updateCardContent(cardId: string, question: string, answer: string): void {
        if (!this.db) return;

        this.db.run(`
            UPDATE cards SET
                question = ?,
                answer = ?,
                updated_at = ?
            WHERE id = ?
        `, [question, answer, Date.now(), cardId]);

        this.markDirty();
    }

    /**
     * Get cards by source note UID
     */
    getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
        if (!this.db) return [];

        const result = this.db.exec(`
            SELECT * FROM cards WHERE source_uid = ?
        `, [sourceUid]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) =>
            this.rowToFSRSCardData(data.columns, row)
        );
    }

    /**
     * Get all cards that have content (question/answer stored in SQL)
     * Joins with source_notes to include source note name
     */
    getCardsWithContent(): FSRSCardData[] {
        if (!this.db) return [];

        const result = this.db.exec(`
            SELECT c.*, s.note_name as source_note_name
            FROM cards c
            LEFT JOIN source_notes s ON c.source_uid = s.uid
            WHERE c.question IS NOT NULL AND c.answer IS NOT NULL
        `);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) =>
            this.rowToFSRSCardData(data.columns, row)
        );
    }

    /**
     * Check if card has content stored in SQL
     */
    hasCardContent(cardId: string): boolean {
        if (!this.db) return false;

        const result = this.db.exec(`
            SELECT 1 FROM cards
            WHERE id = ? AND question IS NOT NULL AND answer IS NOT NULL
            LIMIT 1
        `, [cardId]);

        return getQueryResult(result) !== null;
    }

    /**
     * Check if any cards have content stored in SQL (migration status)
     */
    hasAnyCardContent(): boolean {
        if (!this.db) return false;

        const result = this.db.exec(`
            SELECT 1 FROM cards
            WHERE question IS NOT NULL AND answer IS NOT NULL
            LIMIT 1
        `);

        return getQueryResult(result) !== null;
    }

    /**
     * Get count of cards with content in SQL
     */
    getCardsWithContentCount(): number {
        if (!this.db) return 0;

        const result = this.db.exec(`
            SELECT COUNT(*) FROM cards
            WHERE question IS NOT NULL AND answer IS NOT NULL
        `);

        const data = getQueryResult(result);
        return data ? (data.values[0]![0] as number) : 0;
    }

    // ===== Source Notes Operations (Schema v2) =====

    /**
     * Insert or update a source note
     */
    upsertSourceNote(info: SourceNoteInfo): void {
        if (!this.db) return;

        const now = Date.now();

        this.db.run(`
            INSERT INTO source_notes (uid, note_name, note_path, deck, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
                note_name = excluded.note_name,
                note_path = excluded.note_path,
                deck = excluded.deck,
                updated_at = excluded.updated_at
        `, [
            info.uid,
            info.noteName,
            info.notePath || null,
            info.deck,
            info.createdAt || now,
            now,
        ]);

        this.markDirty();
    }

    /**
     * Get a source note by UID
     */
    getSourceNote(uid: string): SourceNoteInfo | null {
        if (!this.db) return null;

        const result = this.db.exec(`
            SELECT * FROM source_notes WHERE uid = ?
        `, [uid]);

        const data = getQueryResult(result);
        if (!data) return null;

        const row = data.values[0]!;
        const cols = data.columns;

        return {
            uid: row[cols.indexOf("uid")] as string,
            noteName: row[cols.indexOf("note_name")] as string,
            notePath: row[cols.indexOf("note_path")] as string | undefined,
            deck: row[cols.indexOf("deck")] as string,
            createdAt: row[cols.indexOf("created_at")] as number | undefined,
            updatedAt: row[cols.indexOf("updated_at")] as number | undefined,
        };
    }

    /**
     * Get source note by note path
     */
    getSourceNoteByPath(notePath: string): SourceNoteInfo | null {
        if (!this.db) return null;

        const result = this.db.exec(`
            SELECT * FROM source_notes WHERE note_path = ?
        `, [notePath]);

        const data = getQueryResult(result);
        if (!data) return null;

        const row = data.values[0]!;
        const cols = data.columns;

        return {
            uid: row[cols.indexOf("uid")] as string,
            noteName: row[cols.indexOf("note_name")] as string,
            notePath: row[cols.indexOf("note_path")] as string | undefined,
            deck: row[cols.indexOf("deck")] as string,
            createdAt: row[cols.indexOf("created_at")] as number | undefined,
            updatedAt: row[cols.indexOf("updated_at")] as number | undefined,
        };
    }

    /**
     * Get all source notes
     */
    getAllSourceNotes(): SourceNoteInfo[] {
        if (!this.db) return [];

        const result = this.db.exec(`SELECT * FROM source_notes`);
        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => {
            const cols = data.columns;
            return {
                uid: row[cols.indexOf("uid")] as string,
                noteName: row[cols.indexOf("note_name")] as string,
                notePath: row[cols.indexOf("note_path")] as string | undefined,
                deck: row[cols.indexOf("deck")] as string,
                createdAt: row[cols.indexOf("created_at")] as number | undefined,
                updatedAt: row[cols.indexOf("updated_at")] as number | undefined,
            };
        });
    }

    /**
     * Update source note path (when file is renamed)
     */
    updateSourceNotePath(uid: string, newPath: string, newName?: string): void {
        if (!this.db) return;

        if (newName) {
            this.db.run(`
                UPDATE source_notes SET
                    note_path = ?,
                    note_name = ?,
                    updated_at = ?
                WHERE uid = ?
            `, [newPath, newName, Date.now(), uid]);
        } else {
            this.db.run(`
                UPDATE source_notes SET
                    note_path = ?,
                    updated_at = ?
                WHERE uid = ?
            `, [newPath, Date.now(), uid]);
        }

        this.markDirty();
    }

    /**
     * Delete source note and optionally detach cards
     */
    deleteSourceNote(uid: string, detachCards = true): void {
        if (!this.db) return;

        if (detachCards) {
            // Set source_uid to NULL for all cards from this source
            this.db.run(`
                UPDATE cards SET source_uid = NULL WHERE source_uid = ?
            `, [uid]);
        }

        this.db.run(`DELETE FROM source_notes WHERE uid = ?`, [uid]);
        this.markDirty();
    }

    // ===== Review Log Operations =====

    /**
     * Add a review log entry
     */
    addReviewLog(
        cardId: string,
        rating: number,
        scheduledDays: number,
        elapsedDays: number,
        state: number,
        timeSpentMs: number
    ): void {
        if (!this.db) return;

        this.db.run(`
            INSERT INTO review_log (
                card_id, reviewed_at, rating, scheduled_days,
                elapsed_days, state, time_spent_ms
            ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
        `, [cardId, rating, scheduledDays, elapsedDays, state, timeSpentMs]);

        this.markDirty();
    }

    /**
     * Get review history for a card (last N entries)
     */
    getCardReviewHistory(cardId: string, limit = 20): CardReviewLogEntry[] {
        if (!this.db) return [];

        const result = this.db.exec(`
            SELECT reviewed_at, rating, scheduled_days, elapsed_days
            FROM review_log
            WHERE card_id = ?
            ORDER BY reviewed_at DESC
            LIMIT ?
        `, [cardId, limit]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => ({
            t: new Date(row[0] as string).getTime(),
            r: row[1] as number,
            s: row[2] as number,
            e: row[3] as number,
        }));
    }

    // ===== Daily Stats Operations =====

    /**
     * Get daily stats for a date
     */
    getDailyStats(date: string): ExtendedDailyStats | null {
        if (!this.db) return null;

        const result = this.db.exec(`
            SELECT * FROM daily_stats WHERE date = ?
        `, [date]);

        const data = getQueryResult(result);
        if (!data) return null;

        // Safe: getQueryResult guarantees values.length > 0
        const row = data.values[0]!;
        const cols = data.columns;

        // Get reviewed card IDs
        const cardIdsResult = this.db.exec(`
            SELECT card_id FROM daily_reviewed_cards WHERE date = ?
        `, [date]);

        const cardIdsData = getQueryResult(cardIdsResult);
        const reviewedCardIds = cardIdsData
            ? cardIdsData.values.map((r) => r[0] as string)
            : [];

        return {
            date: row[cols.indexOf("date")] as string,
            reviewsCompleted: row[cols.indexOf("reviews_completed")] as number,
            newCardsStudied: row[cols.indexOf("new_cards_studied")] as number,
            totalTimeMs: row[cols.indexOf("total_time_ms")] as number,
            again: row[cols.indexOf("again_count")] as number,
            hard: row[cols.indexOf("hard_count")] as number,
            good: row[cols.indexOf("good_count")] as number,
            easy: row[cols.indexOf("easy_count")] as number,
            newCards: row[cols.indexOf("new_cards")] as number,
            learningCards: row[cols.indexOf("learning_cards")] as number,
            reviewCards: row[cols.indexOf("review_cards")] as number,
            reviewedCardIds,
        };
    }

    /**
     * Update daily stats
     */
    updateDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
        if (!this.db) return;

        // Upsert daily stats
        this.db.run(`
            INSERT INTO daily_stats (
                date, reviews_completed, new_cards_studied, total_time_ms,
                again_count, hard_count, good_count, easy_count,
                new_cards, learning_cards, review_cards
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                reviews_completed = reviews_completed + excluded.reviews_completed,
                new_cards_studied = new_cards_studied + excluded.new_cards_studied,
                total_time_ms = total_time_ms + excluded.total_time_ms,
                again_count = again_count + excluded.again_count,
                hard_count = hard_count + excluded.hard_count,
                good_count = good_count + excluded.good_count,
                easy_count = easy_count + excluded.easy_count,
                new_cards = new_cards + excluded.new_cards,
                learning_cards = learning_cards + excluded.learning_cards,
                review_cards = review_cards + excluded.review_cards
        `, [
            date,
            stats.reviewsCompleted || 0,
            stats.newCardsStudied || 0,
            stats.totalTimeMs || 0,
            stats.again || 0,
            stats.hard || 0,
            stats.good || 0,
            stats.easy || 0,
            stats.newCards || 0,
            stats.learningCards || 0,
            stats.reviewCards || 0,
        ]);

        this.markDirty();
    }

    /**
     * Record a reviewed card for daily limits
     */
    recordReviewedCard(date: string, cardId: string): void {
        if (!this.db) return;

        this.db.run(`
            INSERT OR IGNORE INTO daily_reviewed_cards (date, card_id)
            VALUES (?, ?)
        `, [date, cardId]);

        this.markDirty();
    }

    /**
     * Get all reviewed card IDs for a date
     */
    getReviewedCardIds(date: string): string[] {
        if (!this.db) return [];

        const result = this.db.exec(`
            SELECT card_id FROM daily_reviewed_cards WHERE date = ?
        `, [date]);

        const data = getQueryResult(result);
        if (!data) return [];
        return data.values.map((row) => row[0] as string);
    }

    /**
     * Get all daily stats
     */
    getAllDailyStats(): Record<string, ExtendedDailyStats> {
        if (!this.db) return {};

        const result = this.db.exec(`SELECT * FROM daily_stats ORDER BY date`);
        const data = getQueryResult(result);
        if (!data) return {};

        const stats: Record<string, ExtendedDailyStats> = {};

        for (const row of data.values) {
            const cols = data.columns;
            const date = row[cols.indexOf("date")] as string;

            // Get reviewed card IDs for this date
            const cardIdsResult = this.db.exec(`
                SELECT card_id FROM daily_reviewed_cards WHERE date = ?
            `, [date]);

            const cardIdsData = getQueryResult(cardIdsResult);
            const reviewedCardIds = cardIdsData
                ? cardIdsData.values.map((r) => r[0] as string)
                : [];

            stats[date] = {
                date,
                reviewsCompleted: row[cols.indexOf("reviews_completed")] as number,
                newCardsStudied: row[cols.indexOf("new_cards_studied")] as number,
                totalTimeMs: row[cols.indexOf("total_time_ms")] as number,
                again: row[cols.indexOf("again_count")] as number,
                hard: row[cols.indexOf("hard_count")] as number,
                good: row[cols.indexOf("good_count")] as number,
                easy: row[cols.indexOf("easy_count")] as number,
                newCards: row[cols.indexOf("new_cards")] as number,
                learningCards: row[cols.indexOf("learning_cards")] as number,
                reviewCards: row[cols.indexOf("review_cards")] as number,
                reviewedCardIds,
            };
        }

        return stats;
    }

    // ===== Aggregation Queries =====

    /**
     * Get card maturity breakdown (for stats panel)
     */
    getCardMaturityBreakdown(): {
        new: number;
        learning: number;
        young: number;
        mature: number;
        suspended: number;
        buried: number;
    } {
        if (!this.db) {
            return { new: 0, learning: 0, young: 0, mature: 0, suspended: 0, buried: 0 };
        }

        const result = this.db.exec(`
            SELECT
                SUM(CASE WHEN suspended = 1 THEN 1 ELSE 0 END) as suspended,
                SUM(CASE WHEN suspended = 0 AND buried_until > datetime('now') THEN 1 ELSE 0 END) as buried,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 0 THEN 1 ELSE 0 END) as new,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state IN (1, 3) THEN 1 ELSE 0 END) as learning,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 2 AND scheduled_days < 21 THEN 1 ELSE 0 END) as young,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 2 AND scheduled_days >= 21 THEN 1 ELSE 0 END) as mature
            FROM cards
        `);

        const data = getQueryResult(result);
        if (!data) {
            return { new: 0, learning: 0, young: 0, mature: 0, suspended: 0, buried: 0 };
        }

        // Safe: getQueryResult guarantees values.length > 0
        const row = data.values[0]!;
        return {
            suspended: (row[0] as number) || 0,
            buried: (row[1] as number) || 0,
            new: (row[2] as number) || 0,
            learning: (row[3] as number) || 0,
            young: (row[4] as number) || 0,
            mature: (row[5] as number) || 0,
        };
    }

    /**
     * Get due cards count by date range
     */
    getDueCardsByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        if (!this.db) return [];

        const result = this.db.exec(`
            SELECT date(due) as due_date, COUNT(*) as count
            FROM cards
            WHERE state != 0
              AND suspended = 0
              AND (buried_until IS NULL OR buried_until <= datetime('now'))
              AND date(due) BETWEEN ? AND ?
            GROUP BY date(due)
            ORDER BY due_date
        `, [startDate, endDate]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => ({
            date: row[0] as string,
            count: row[1] as number,
        }));
    }

    // ===== Persistence =====

    /**
     * Mark database as dirty (needs saving)
     */
    private markDirty(): void {
        this.isDirty = true;
        this.scheduleSave();
    }

    /**
     * Schedule a debounced save
     */
    private scheduleSave(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(async () => {
            await this.flush();
        }, SAVE_DEBOUNCE_MS);
    }

    /**
     * Flush database to disk
     */
    async flush(): Promise<void> {
        if (!this.db || !this.isDirty) return;

        try {
            const data = this.db.export();
            const dbPath = this.getDbPath();

            // Ensure directory exists
            const folderPath = normalizePath(DB_FOLDER);
            const folderExists = await this.app.vault.adapter.exists(folderPath);
            if (!folderExists) {
                await this.app.vault.adapter.mkdir(folderPath);
            }

            await this.app.vault.adapter.writeBinary(dbPath, data.buffer);
            this.isDirty = false;
        } catch (error) {
            console.error("[Episteme] Failed to save database:", error);
        }
    }

    /**
     * Force immediate save
     */
    async saveNow(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        await this.flush();
    }

    /**
     * Close database and cleanup
     */
    async close(): Promise<void> {
        await this.saveNow();
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.isLoaded = false;
    }

    /**
     * Merge with data from disk (for sync conflict resolution)
     * Uses "last-review-wins" strategy
     */
    async mergeFromDisk(): Promise<{ merged: number; conflicts: number }> {
        if (!this.db || !this.SQL) {
            return { merged: 0, conflicts: 0 };
        }

        let merged = 0;
        let conflicts = 0;

        try {
            // Load database from disk
            const dbPath = this.getDbPath();
            const diskData = await this.loadFromFile(dbPath);

            if (!diskData) {
                return { merged, conflicts };
            }

            // Create temporary database from disk data
            const diskDb = new this.SQL.Database(diskData);

            // Get all cards from disk
            const diskResult = diskDb.exec(`SELECT * FROM cards`);
            const diskCards = getQueryResult(diskResult);

            if (!diskCards) {
                diskDb.close();
                return { merged, conflicts };
            }

            // Compare and merge
            for (const diskRow of diskCards.values) {
                const id = diskRow[diskCards.columns.indexOf("id")] as string;
                const diskLastReview = diskRow[diskCards.columns.indexOf("last_review")] as string | null;

                const memCard = this.get(id);

                if (!memCard) {
                    // Card only on disk - import it
                    const diskCard = this.rowToFSRSCardData(diskCards.columns, diskRow);
                    this.set(id, diskCard);
                    merged++;
                } else if (diskLastReview && memCard.lastReview) {
                    // Both have review data - compare timestamps
                    const diskTime = new Date(diskLastReview).getTime();
                    const memTime = new Date(memCard.lastReview).getTime();

                    if (diskTime > memTime) {
                        // Disk is newer - use disk version
                        const diskCard = this.rowToFSRSCardData(diskCards.columns, diskRow);
                        this.set(id, diskCard);
                        conflicts++;
                    }
                } else if (diskLastReview && !memCard.lastReview) {
                    // Disk has review, memory doesn't - use disk
                    const diskCard = this.rowToFSRSCardData(diskCards.columns, diskRow);
                    this.set(id, diskCard);
                    conflicts++;
                }
            }

            diskDb.close();

            // Emit event if any changes were merged
            if (merged > 0 || conflicts > 0) {
                getEventBus().emit({
                    type: "store:synced",
                    merged,
                    conflicts,
                    timestamp: Date.now(),
                } as StoreSyncedEvent);
            }
        } catch (error) {
            console.warn("[Episteme] Failed to merge from disk:", error);
        }

        return { merged, conflicts };
    }

    // ===== Helpers =====

    /**
     * Convert database row to FSRSCardData (schema v2 - includes content)
     */
    private rowToFSRSCardData(
        columns: string[],
        values: SqlRow
    ): FSRSCardData {
        const getCol = (name: string) => {
            const idx = columns.indexOf(name);
            return idx >= 0 ? values[idx] : null;
        };

        // Parse tags JSON if present
        const tagsRaw = getCol("tags") as string | null;
        let tags: string[] | undefined;
        if (tagsRaw) {
            try {
                tags = JSON.parse(tagsRaw);
            } catch {
                tags = undefined;
            }
        }

        return {
            id: getCol("id") as string,
            due: getCol("due") as string,
            stability: getCol("stability") as number,
            difficulty: getCol("difficulty") as number,
            reps: getCol("reps") as number,
            lapses: getCol("lapses") as number,
            state: getCol("state") as State,
            lastReview: getCol("last_review") as string | null,
            scheduledDays: getCol("scheduled_days") as number,
            learningStep: getCol("learning_step") as number,
            suspended: getCol("suspended") === 1,
            buriedUntil: getCol("buried_until") as string | undefined,
            createdAt: getCol("created_at") as number | undefined,
            // Schema v2 fields
            question: getCol("question") as string | undefined,
            answer: getCol("answer") as string | undefined,
            sourceUid: getCol("source_uid") as string | undefined,
            sourceNoteName: getCol("source_note_name") as string | undefined,
            tags,
        };
    }

    /**
     * Get database statistics
     */
    getStats(): {
        totalCards: number;
        totalReviews: number;
        dbSizeKB: number;
        isLoaded: boolean;
    } {
        if (!this.db) {
            return { totalCards: 0, totalReviews: 0, dbSizeKB: 0, isLoaded: false };
        }

        const cardsResult = this.db.exec(`SELECT COUNT(*) FROM cards`);
        const reviewsResult = this.db.exec(`SELECT COUNT(*) FROM review_log`);

        const cardsData = getQueryResult(cardsResult);
        const reviewsData = getQueryResult(reviewsResult);

        const dbData = this.db.export();
        const dbSizeKB = Math.round(dbData.length / 1024);

        return {
            totalCards: cardsData ? cardsData.values[0]![0] as number : 0,
            totalReviews: reviewsData ? reviewsData.values[0]![0] as number : 0,
            dbSizeKB,
            isLoaded: this.isLoaded,
        };
    }
}

/**
 * Extended FSRSCardData with additional fields stored in database
 */
interface FSRSCardDataExtended extends FSRSCardData {
    deck?: string;
    sourceNoteName?: string;
    filePath?: string;
}

