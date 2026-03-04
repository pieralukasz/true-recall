import { getBuiltinNoteTypes } from "@features/core/persistence/sqlite/modules/NoteTypeActions";
import type { DatabaseLike } from "@features/core/persistence/sqlite/sqlite.types";

export class SqliteSchemaManager {
	constructor(private db: DatabaseLike) {}

	createTables(): void {
		this.db.run(`
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

            CREATE TABLE IF NOT EXISTS daily_reviewed_cards (
                date TEXT NOT NULL,
                card_id TEXT NOT NULL,
                PRIMARY KEY (date, card_id)
            );

            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT
            );

            INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1');
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
}
