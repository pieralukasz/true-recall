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
     * Create database tables (schema v7)
     */
    createTables(): void {
        this.db.run(`
            -- Cards table with FSRS scheduling data + content (v7)
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

            -- Source notes table (v5: removed deck column)
            CREATE TABLE IF NOT EXISTS source_notes (
                uid TEXT PRIMARY KEY,
                note_name TEXT NOT NULL,
                note_path TEXT,
                created_at INTEGER,
                updated_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_source_notes_name ON source_notes(note_name);

            -- Projects table (v5: new)
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at INTEGER,
                updated_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

            -- Note-Project junction table (v5: new, many-to-many)
            CREATE TABLE IF NOT EXISTS note_projects (
                source_uid TEXT NOT NULL,
                project_id INTEGER NOT NULL,
                created_at INTEGER,
                PRIMARY KEY (source_uid, project_id),
                FOREIGN KEY (source_uid) REFERENCES source_notes(uid) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_note_projects_source ON note_projects(source_uid);
            CREATE INDEX IF NOT EXISTS idx_note_projects_project ON note_projects(project_id);

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

            -- Card image references (for tracking images in flashcards)
            CREATE TABLE IF NOT EXISTS card_image_refs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id TEXT NOT NULL,
                image_path TEXT NOT NULL,
                field TEXT NOT NULL,
                created_at INTEGER,
                FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_image_refs_path ON card_image_refs(image_path);
            CREATE INDEX IF NOT EXISTS idx_image_refs_card ON card_image_refs(card_id);

            -- Metadata
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            -- Set schema version
            INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '7');
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

        if (currentVersion < 4) {
            this.migrateV3toV4();
        }

        if (currentVersion < 5) {
            this.migrateV4toV5();
        }

        if (currentVersion < 6) {
            this.migrateV5toV6();
        }

        if (currentVersion < 7) {
            this.migrateV6toV7();
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

    /**
     * Migrate from v3 to v4 (add card_image_refs table)
     */
    private migrateV3toV4(): void {
        console.log("[Episteme] Migrating schema v3 -> v4...");

        try {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS card_image_refs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    card_id TEXT NOT NULL,
                    image_path TEXT NOT NULL,
                    field TEXT NOT NULL,
                    created_at INTEGER,
                    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_image_refs_path ON card_image_refs(image_path);
                CREATE INDEX IF NOT EXISTS idx_image_refs_card ON card_image_refs(card_id);
            `);

            this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '4')");
            console.log("[Episteme] Schema migration v3->v4 completed");
            this.onSchemaChange();
        } catch (error) {
            console.error("[Episteme] Schema migration v3->v4 failed:", error);
        }
    }

    /**
     * Migrate from v4 to v5 (project-based learning system)
     * - Create projects table
     * - Create note_projects junction table (many-to-many)
     * - Remove deck column from source_notes (clean slate migration)
     */
    private migrateV4toV5(): void {
        console.log("[Episteme] Migrating schema v4 -> v5...");

        try {
            // 1. Create projects table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    created_at INTEGER,
                    updated_at INTEGER
                )
            `);

            try {
                this.db.run("CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)");
            } catch {
                // Index might already exist
            }

            // 2. Create note_projects junction table (many-to-many)
            this.db.run(`
                CREATE TABLE IF NOT EXISTS note_projects (
                    source_uid TEXT NOT NULL,
                    project_id INTEGER NOT NULL,
                    created_at INTEGER,
                    PRIMARY KEY (source_uid, project_id),
                    FOREIGN KEY (source_uid) REFERENCES source_notes(uid) ON DELETE CASCADE,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
            `);

            try {
                this.db.run("CREATE INDEX IF NOT EXISTS idx_note_projects_source ON note_projects(source_uid)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_note_projects_project ON note_projects(project_id)");
            } catch {
                // Indexes might already exist
            }

            // 3. Recreate source_notes without deck column (clean slate - deck data is discarded)
            this.db.run(`
                CREATE TABLE source_notes_new (
                    uid TEXT PRIMARY KEY,
                    note_name TEXT NOT NULL,
                    note_path TEXT,
                    created_at INTEGER,
                    updated_at INTEGER
                );

                INSERT INTO source_notes_new (uid, note_name, note_path, created_at, updated_at)
                SELECT uid, note_name, note_path, created_at, updated_at
                FROM source_notes;

                DROP TABLE source_notes;
                ALTER TABLE source_notes_new RENAME TO source_notes;

                CREATE INDEX idx_source_notes_name ON source_notes(note_name);
            `);

            this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '5')");
            console.log("[Episteme] Schema migration v4->v5 completed");
            this.onSchemaChange();
        } catch (error) {
            console.error("[Episteme] Schema migration v4->v5 failed:", error);
        }
    }

    /**
     * Migrate from v5 to v6 (fix data corruption)
     * 1. Restores created_at from earliest review in review_log
     * 2. Fixes state for cards that have reviews but are marked as New (state=0)
     */
    private migrateV5toV6(): void {
        console.log("[Episteme] Migrating schema v5 -> v6 (fixing data corruption)...");

        try {
            // Part 1: Fix created_at for cards that have reviews before their supposed creation date
            // This is impossible (can't review a card before it exists), so the created_at is wrong
            const createdAtResult = this.db.exec(`
                SELECT c.id, c.created_at,
                       MIN(strftime('%s', r.reviewed_at) * 1000) as earliest_review
                FROM cards c
                JOIN review_log r ON r.card_id = c.id
                WHERE c.created_at IS NOT NULL
                GROUP BY c.id
                HAVING earliest_review < c.created_at
            `);

            const createdAtData = getQueryResult(createdAtResult);
            if (createdAtData && createdAtData.values.length > 0) {
                console.log(`[Episteme] Found ${createdAtData.values.length} cards with corrupted created_at`);

                for (const row of createdAtData.values) {
                    const cardId = row[0] as string;
                    const earliestReview = row[2] as number;

                    this.db.run(
                        `UPDATE cards SET created_at = ? WHERE id = ?`,
                        [earliestReview, cardId]
                    );
                }

                console.log(`[Episteme] Fixed created_at for ${createdAtData.values.length} cards`);
            } else {
                console.log("[Episteme] No cards with corrupted created_at found");
            }

            // Part 2: Fix state for cards that have reviews but are marked as New (state=0)
            // This is impossible - if a card has been reviewed, it cannot be in New state
            const stateResult = this.db.exec(`
                SELECT c.id,
                       (SELECT rating FROM review_log WHERE card_id = c.id ORDER BY reviewed_at DESC LIMIT 1) as last_rating
                FROM cards c
                WHERE c.state = 0
                  AND EXISTS (SELECT 1 FROM review_log WHERE card_id = c.id)
            `);

            const stateData = getQueryResult(stateResult);
            if (stateData && stateData.values.length > 0) {
                console.log(`[Episteme] Found ${stateData.values.length} cards with corrupted state (New with reviews)`);

                for (const row of stateData.values) {
                    const cardId = row[0] as string;
                    const lastRating = row[1] as number;
                    // If last rating was Again(1) or Hard(2), set to Relearning(3), else Review(2)
                    const newState = (lastRating <= 2) ? 3 : 2;

                    this.db.run(
                        `UPDATE cards SET state = ? WHERE id = ?`,
                        [newState, cardId]
                    );
                }

                console.log(`[Episteme] Fixed state for ${stateData.values.length} cards`);
            } else {
                console.log("[Episteme] No cards with corrupted state found");
            }

            this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '6')");
            console.log("[Episteme] Schema migration v5->v6 completed");
            this.onSchemaChange();
        } catch (error) {
            console.error("[Episteme] Schema migration v5->v6 failed:", error);
        }
    }

    /**
     * Migrate from v6 to v7 (sync card created_at with source notes)
     * Sets cards.created_at to match source_notes.created_at
     */
    private migrateV6toV7(): void {
        console.log("[Episteme] Migrating schema v6 -> v7 (syncing card created_at with source notes)...");

        try {
            const result = this.db.exec(`
                SELECT c.id, s.created_at as source_created_at
                FROM cards c
                INNER JOIN source_notes s ON c.source_uid = s.uid
                WHERE c.created_at != s.created_at
            `);

            const data = getQueryResult(result);

            if (data && data.values.length > 0) {
                console.log(`[Episteme] Found ${data.values.length} cards to sync with source notes`);

                for (const row of data.values) {
                    const cardId = row[0] as string;
                    const sourceCreatedAt = row[1] as number;

                    this.db.run(
                        `UPDATE cards SET created_at = ? WHERE id = ?`,
                        [sourceCreatedAt, cardId]
                    );
                }

                console.log(`[Episteme] Synced created_at for ${data.values.length} cards`);
            } else {
                console.log("[Episteme] No cards needed created_at sync");
            }

            this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '7')");
            console.log("[Episteme] Schema migration v6->v7 completed");
            this.onSchemaChange();
        } catch (error) {
            console.error("[Episteme] Schema migration v6->v7 failed:", error);
        }
    }
}
