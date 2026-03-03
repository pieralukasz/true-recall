/**
 * SQLite Schema Manager
 * Database schema creation and migrations
 *
 * Uses modular migration functions from the migrations/ folder
 */

import * as migrations from "@features/core/persistence/sqlite/migrations";
import { getBuiltinNoteTypes } from "@features/core/persistence/sqlite/modules/NoteTypeActions";
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
		25: migrations.migration024ToV25,
		26: migrations.migration025ToV26,
	};

	constructor(db: DatabaseLike, onSchemaChange: () => void) {
		this.db = db;
		this.onSchemaChange = onSchemaChange;
	}

	createTables(): void {
		this.db.run(`
            -- Note types (v26)
            CREATE TABLE IF NOT EXISTS note_types (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                type INTEGER NOT NULL DEFAULT 0,
                fields_json TEXT NOT NULL,
                templates_json TEXT NOT NULL,
                css TEXT DEFAULT '',
                is_builtin INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER,
                updated_at INTEGER,
                deleted_at INTEGER DEFAULT NULL
            );

            -- Notes (v26)
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY NOT NULL,
                note_type_id TEXT NOT NULL,
                fields_json TEXT NOT NULL,
                tags TEXT DEFAULT '',
                source_uid TEXT,
                source_text TEXT,
                created_via TEXT DEFAULT 'manual',
                created_at INTEGER,
                updated_at INTEGER,
                deleted_at INTEGER DEFAULT NULL,
                FOREIGN KEY (note_type_id) REFERENCES note_types(id)
            );

            CREATE INDEX IF NOT EXISTS idx_notes_note_type ON notes(note_type_id);
            CREATE INDEX IF NOT EXISTS idx_notes_source_uid ON notes(source_uid);
            CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at);

            -- Cards table with FSRS scheduling data (v26: no question/answer)
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY NOT NULL,
                note_id TEXT NOT NULL,
                template_ord INTEGER NOT NULL DEFAULT 0,
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
                source_uid TEXT,
                FOREIGN KEY (note_id) REFERENCES notes(id)
            );

            CREATE INDEX IF NOT EXISTS idx_cards_note_id ON cards(note_id);
            CREATE INDEX IF NOT EXISTS idx_cards_note_template ON cards(note_id, template_ord);
            CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
            CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
            CREATE INDEX IF NOT EXISTS idx_cards_suspended ON cards(suspended);
            CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid);
            CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_cards_active ON cards(deleted_at, suspended, state);
            CREATE INDEX IF NOT EXISTS idx_cards_due_active ON cards(due, deleted_at, suspended);

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
            INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '26');
            INSERT OR REPLACE INTO meta (key, value) VALUES ('created_at', datetime('now'));
        `);

		// Seed built-in note types for fresh installs
		const builtins = getBuiltinNoteTypes();
		const now = Date.now();
		for (const nt of builtins) {
			this.db.run(
				`INSERT OR IGNORE INTO note_types (id, name, type, fields_json, templates_json, css, is_builtin, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
				[
					nt.id,
					nt.name,
					nt.type,
					JSON.stringify(nt.fields),
					JSON.stringify(nt.templates),
					nt.css,
					now,
					now,
				],
			);
		}
	}

	runMigrations(): void {
		const currentVersion = this.getSchemaVersion();
		const latestVersion = 26;

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

			const requiredTables = ["cards", "meta", "note_types", "notes"];
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
