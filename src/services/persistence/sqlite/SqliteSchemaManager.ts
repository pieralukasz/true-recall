/**
 * SQLite Schema Manager
 * Database schema creation and migrations
 */
import type { Database } from "sql.js";
import { getQueryResult } from "./sqlite.types";

/**
 * Manages SQLite database schema and migrations
 */
export class SqliteSchemaManager {
    private db: Database;
    private onSchemaChange: () => void;

    constructor(db: Database, onSchemaChange: () => void) {
        this.db = db;
        this.onSchemaChange = onSchemaChange;
    }

    /**
     * Create database tables (schema v3)
     */
    createTables(): void {
        this.db.run(`
            -- Cards table with FSRS scheduling data + content (v3)
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

            -- Source notes table
            CREATE TABLE IF NOT EXISTS source_notes (
                uid TEXT PRIMARY KEY,
                note_name TEXT NOT NULL,
                note_path TEXT,
                deck TEXT DEFAULT 'Knowledge',
                created_at INTEGER,
                updated_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_source_notes_name ON source_notes(note_name);

            -- Review history log
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

            -- Reviewed card IDs per day
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

            -- Set schema version
            INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '3');
            INSERT OR REPLACE INTO meta (key, value) VALUES ('created_at', datetime('now'));
        `);
    }

    /**
     * Run all necessary migrations
     */
    runMigrations(): void {
        const currentVersion = this.getSchemaVersion();

        if (currentVersion < 2) {
            this.migrateV1toV2();
        }

        if (currentVersion < 3) {
            this.migrateV2toV3();
        }
    }

    /**
     * Get current schema version
     */
    private getSchemaVersion(): number {
        try {
            const result = this.db.exec("SELECT value FROM meta WHERE key = 'schema_version'");
            const data = getQueryResult(result);
            if (data && data.values.length > 0) {
                return parseInt(data.values[0]![0] as string, 10) || 1;
            }
        } catch {
            // meta table might not exist
        }
        return 1;
    }

    /**
     * Migrate from v1 to v2
     */
    private migrateV1toV2(): void {
        console.log("[Episteme] Migrating schema v1 -> v2...");

        try {
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
                    // Column might already exist
                }
            }

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

            try {
                this.db.run("CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_source_notes_name ON source_notes(note_name)");
            } catch {
                // Indexes might already exist
            }

            this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2')");
            console.log("[Episteme] Schema migration v1->v2 completed");
            this.onSchemaChange();
        } catch (error) {
            console.error("[Episteme] Schema migration v1->v2 failed:", error);
        }
    }

    /**
     * Migrate from v2 to v3 (remove legacy columns)
     */
    private migrateV2toV3(): void {
        console.log("[Episteme] Migrating schema v2 -> v3...");

        try {
            this.db.run(`
                CREATE TABLE cards_new (
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

                INSERT INTO cards_new
                SELECT id, due, stability, difficulty, reps, lapses, state,
                       last_review, scheduled_days, learning_step, suspended,
                       buried_until, created_at, updated_at,
                       question, answer, source_uid, tags
                FROM cards;

                DROP TABLE cards;
                ALTER TABLE cards_new RENAME TO cards;

                CREATE INDEX idx_cards_due ON cards(due);
                CREATE INDEX idx_cards_state ON cards(state);
                CREATE INDEX idx_cards_suspended ON cards(suspended);
                CREATE INDEX idx_cards_source_uid ON cards(source_uid);
            `);

            this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '3')");
            console.log("[Episteme] Schema migration v2->v3 completed");
            this.onSchemaChange();
        } catch (error) {
            console.error("[Episteme] Schema migration v2->v3 failed:", error);
        }
    }
}
