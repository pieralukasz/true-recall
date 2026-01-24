/**
 * SQLite Schema Manager
 * Database schema creation and migrations
 *
 * Uses modular migration functions from the migrations/ folder
 */
import { getQueryResult, type DatabaseLike } from "./sqlite.types";
import * as migrations from "./migrations";

// ===== Migration Type Definitions =====

type MigrationFn = (db: DatabaseLike) => void;

// ===== Schema Manager Class =====

/**
 * Manages SQLite database schema and migrations
 */
export class SqliteSchemaManager {
    private db: DatabaseLike;
    private onSchemaChange: () => void;

    // Map of schema version -> migration function
    private readonly MIGRATIONS: Record<number, MigrationFn> = {
        2: migrations.migration001ToV2,
        3: migrations.migration002ToV3,
        4: migrations.migration003ToV4,
        5: migrations.migration004ToV5,
        6: migrations.migration005ToV6,
        7: migrations.migration006ToV7,
        8: migrations.migration007ToV8,
        9: migrations.migration008ToV9,
        10: migrations.migration009ToV10,
        11: migrations.migration010ToV11,
        12: migrations.migration011ToV12,
        13: migrations.migration012ToV13,
        14: migrations.migration013ToV14,
        15: migrations.migration014ToV15,
    };

    constructor(db: DatabaseLike, onSchemaChange: () => void) {
        this.db = db;
        this.onSchemaChange = onSchemaChange;
    }

    /**
     * Create database tables (schema v15 - removed note_projects, simplified source_notes)
     */
    createTables(): void {
        this.db.run(`
            -- Cards table with FSRS scheduling data + content
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY NOT NULL,
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
                deleted_at INTEGER DEFAULT NULL,
                question TEXT,
                answer TEXT,
                source_uid TEXT
            );

            -- Indexes for common queries
            CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
            CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
            CREATE INDEX IF NOT EXISTS idx_cards_suspended ON cards(suspended);
            CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid);
            CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at);

            -- Source notes table (v15: simplified, only UID + timestamps)
            CREATE TABLE IF NOT EXISTS source_notes (
                uid TEXT PRIMARY KEY NOT NULL,
                created_at INTEGER,
                updated_at INTEGER,
                deleted_at INTEGER DEFAULT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_source_notes_deleted ON source_notes(deleted_at);

            -- Projects table (v10: TEXT UUID PK)
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT UNIQUE NOT NULL,
                created_at INTEGER,
                updated_at INTEGER,
                deleted_at INTEGER DEFAULT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
            CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at);

            -- Review history log (v10: TEXT UUID PK)
            CREATE TABLE IF NOT EXISTS review_log (
                id TEXT PRIMARY KEY NOT NULL,
                card_id TEXT NOT NULL,
                reviewed_at TEXT NOT NULL,
                rating INTEGER NOT NULL,
                scheduled_days INTEGER,
                elapsed_days INTEGER,
                state INTEGER,
                time_spent_ms INTEGER,
                updated_at INTEGER,
                deleted_at INTEGER DEFAULT NULL,
                FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_revlog_card ON review_log(card_id);
            CREATE INDEX IF NOT EXISTS idx_revlog_date ON review_log(reviewed_at);
            CREATE INDEX IF NOT EXISTS idx_revlog_deleted ON review_log(deleted_at);

            -- Daily statistics
            CREATE TABLE IF NOT EXISTS daily_stats (
                date TEXT PRIMARY KEY NOT NULL,
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

            -- Card image references (v10: TEXT UUID PK)
            CREATE TABLE IF NOT EXISTS card_image_refs (
                id TEXT PRIMARY KEY NOT NULL,
                card_id TEXT NOT NULL,
                image_path TEXT NOT NULL,
                field TEXT NOT NULL,
                created_at INTEGER,
                updated_at INTEGER,
                deleted_at INTEGER DEFAULT NULL,
                FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_image_refs_path ON card_image_refs(image_path);
            CREATE INDEX IF NOT EXISTS idx_image_refs_card ON card_image_refs(card_id);
            CREATE INDEX IF NOT EXISTS idx_image_refs_deleted ON card_image_refs(deleted_at);

            -- Metadata
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT
            );

            -- Set schema version
            INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '15');
            INSERT OR REPLACE INTO meta (key, value) VALUES ('created_at', datetime('now'));
        `);
    }

    /**
     * Run all necessary migrations using data-driven approach
     */
    runMigrations(): void {
        const currentVersion = this.getSchemaVersion();
        const latestVersion = 15;

        if (currentVersion >= latestVersion) {
            return; // Already at latest version
        }

        console.log(`[Episteme] Running migrations from v${currentVersion} to v${latestVersion}...`);

        for (let v = currentVersion + 1; v <= latestVersion; v++) {
            console.log(`[Episteme] Migrating to schema v${v}...`);

            const migration = this.MIGRATIONS[v];
            if (migration) {
                try {
                    migration(this.db);
                } catch (e) {
                    console.error(`[Episteme] Migration failed for v${v}:`, e);
                    throw e;
                }
            } else {
                console.error(`[Episteme] No migration found for version v${v}`);
                throw new Error(`Missing migration for schema version ${v}`);
            }

            this.onSchemaChange();
        }

        // Validate database integrity after migrations
        if (!this.validateDatabaseIntegrity()) {
            throw new Error("Database integrity check failed after migration");
        }

        console.log(`[Episteme] All migrations completed. Current schema version: v${latestVersion}`);
    }

    /**
     * Validate that required tables exist after migrations
     */
    private validateDatabaseIntegrity(): boolean {
        try {
            const tables = this.db.exec(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            );

            const requiredTables = ["cards", "source_notes", "meta"];
            const existingTables = tables[0]?.values.map((r) => r[0] as string) || [];

            for (const table of requiredTables) {
                if (!existingTables.includes(table)) {
                    console.error(`[Episteme] Missing required table: ${table}`);
                    return false;
                }
            }

            console.log("[Episteme] Database integrity check passed");
            return true;
        } catch (error) {
            console.error("[Episteme] Integrity check failed:", error);
            return false;
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
}
