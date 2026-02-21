/**
 * SQLite Schema Manager
 * Database schema creation and migrations
 *
 * Uses modular migration functions from the migrations/ folder
 */

import * as migrations from "@features/core/persistence/sqlite/migrations";
import {
	type DatabaseLike,
	getQueryResult,
} from "@features/core/persistence/sqlite/sqlite.types";

type MigrationFn = (db: DatabaseLike) => void;

export class SqliteSchemaManager {
	private db: DatabaseLike;
	private onSchemaChange: () => void;

	// Map of schema version -> migration function
	// Note: Old migrations (v1-v14) removed - project not released yet
	private readonly MIGRATIONS: Record<number, MigrationFn> = {
		16: migrations.migration015ToV16,
		17: migrations.migration016ToV17,
		18: migrations.migration017ToV18,
		19: migrations.migration018ToV19,
		20: migrations.migration019ToV20,
		21: migrations.migration020ToV21,
		22: migrations.migration021ToV22,
		23: migrations.migration022ToV23,
		24: migrations.migration023ToV24,
	};

	constructor(db: DatabaseLike, onSchemaChange: () => void) {
		this.db = db;
		this.onSchemaChange = onSchemaChange;
	}

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
                source_uid TEXT,
                card_type TEXT NOT NULL DEFAULT 'basic',
                cloze_template TEXT,
                cloze_index INTEGER,
                reverse_of TEXT,
                io_image_path TEXT,
                io_regions_json TEXT,
                io_group_key TEXT,
                io_parent_id TEXT,
                created_via TEXT DEFAULT 'manual'
            );

            -- Indexes for common queries
            CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
            CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
            CREATE INDEX IF NOT EXISTS idx_cards_suspended ON cards(suspended);
            CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid);
            CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at);

            -- Composite indexes for common filtered queries
            CREATE INDEX IF NOT EXISTS idx_cards_active ON cards(deleted_at, suspended, state);
            CREATE INDEX IF NOT EXISTS idx_cards_due_active ON cards(due, deleted_at, suspended);
            CREATE INDEX IF NOT EXISTS idx_cards_card_type ON cards(card_type);
            CREATE INDEX IF NOT EXISTS idx_cards_reverse_of ON cards(reverse_of);
            CREATE INDEX IF NOT EXISTS idx_cards_io_parent ON cards(io_parent_id);

            -- Review history log 
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
                preset_name TEXT,
                FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_revlog_card ON review_log(card_id);
            CREATE INDEX IF NOT EXISTS idx_revlog_date ON review_log(reviewed_at);
            CREATE INDEX IF NOT EXISTS idx_revlog_deleted ON review_log(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_revlog_card_active ON review_log(card_id, deleted_at);
            CREATE INDEX IF NOT EXISTS idx_revlog_preset ON review_log(preset_name);

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

            -- Metadata
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT
            );

            -- Set schema version
            INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '24');
            INSERT OR REPLACE INTO meta (key, value) VALUES ('created_at', datetime('now'));
        `);
	}

	runMigrations(): void {
		const currentVersion = this.getSchemaVersion();
		const latestVersion = 24;

		if (currentVersion >= latestVersion) {
			return; // Already at latest version
		}

		for (let v = currentVersion + 1; v <= latestVersion; v++) {
			const migration = this.MIGRATIONS[v];
			if (migration) {
				try {
					migration(this.db);
				} catch (e) {
					console.error(`[True Recall] Migration failed for v${v}:`, e);
					throw e;
				}
			} else {
				console.error(`[True Recall] No migration found for version v${v}`);
				throw new Error(`Missing migration for schema version ${v}`);
			}

			this.onSchemaChange();
		}

		// Validate database integrity after migrations
		if (!this.validateDatabaseIntegrity()) {
			throw new Error("Database integrity check failed after migration");
		}
	}

	private validateDatabaseIntegrity(): boolean {
		try {
			const tables = this.db.exec(
				"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
			);

			const requiredTables = ["cards", "meta"];
			const existingTables = tables[0]?.values.map((r) => r[0] as string) || [];

			for (const table of requiredTables) {
				if (!existingTables.includes(table)) {
					console.error(`[True Recall] Missing required table: ${table}`);
					return false;
				}
			}

			return true;
		} catch (error) {
			console.error("[True Recall] Integrity check failed:", error);
			return false;
		}
	}

	private getSchemaVersion(): number {
		try {
			const result = this.db.exec(
				"SELECT value FROM meta WHERE key = 'schema_version'",
			);
			const data = getQueryResult(result);
			if (data && data.values.length > 0) {
				return parseInt(data.values[0]?.[0] as string, 10) || 1;
			}
		} catch {
			// meta table might not exist
		}
		return 1;
	}
}
