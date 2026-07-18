import { BUILTIN_SLUGS } from "../../types/note.types";
import { getBuiltinNoteTypes } from "./modules/NoteTypeActions";
import type { DatabaseLike } from "./sqlite.types";

export class SqliteSchemaManager {
	constructor(private db: DatabaseLike) {}

	createTables(): void {
		this.db.run(`
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS note_types (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                type INTEGER NOT NULL DEFAULT 0,
                fields_json TEXT NOT NULL,
                templates_json TEXT NOT NULL,
                css TEXT DEFAULT '',
                is_builtin INTEGER NOT NULL DEFAULT 0,
                slug TEXT,
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
            CREATE INDEX IF NOT EXISTS idx_notes_created_via ON notes(created_via);

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
            CREATE INDEX IF NOT EXISTS idx_revlog_preset_date ON review_log(deleted_at, preset_name, reviewed_at);

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

            CREATE TABLE IF NOT EXISTS assistant_tasks (
                id TEXT PRIMARY KEY NOT NULL,
                thread_id TEXT,
                instruction TEXT NOT NULL,
                preset_id TEXT,
                context_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                result_manifest_json TEXT,
                error TEXT,
                created_at INTEGER NOT NULL,
                finished_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_assistant_tasks_status ON assistant_tasks(status);

			CREATE TABLE IF NOT EXISTS assistant_threads (
				id TEXT PRIMARY KEY NOT NULL,
				title TEXT NOT NULL,
				context_json TEXT NOT NULL,
				state TEXT NOT NULL DEFAULT 'active',
				messages_json TEXT NOT NULL DEFAULT '[]',
				manifest_json TEXT,
				revisions_json TEXT NOT NULL DEFAULT '[]',
				revision INTEGER NOT NULL DEFAULT 0,
				active_task_id TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_assistant_threads_state_updated
			ON assistant_threads(state, updated_at DESC);

            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT
            );

            INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1');
            INSERT OR REPLACE INTO meta (key, value) VALUES ('created_at', datetime('now'));
        `);

		// Add slug column for existing databases (idempotent — SQLite errors silently if column exists)
		try {
			this.db.run(`ALTER TABLE note_types ADD COLUMN slug TEXT`);
		} catch {
			// Column already exists — expected for new installs
		}
		try {
			this.db.run(`ALTER TABLE assistant_tasks ADD COLUMN thread_id TEXT`);
		} catch {
			// Column already exists — expected for new installs
		}
		this.db.run(
			`CREATE INDEX IF NOT EXISTS idx_assistant_tasks_thread ON assistant_tasks(thread_id)`,
		);

		// Seed built-in note types for fresh installs
		const builtins = getBuiltinNoteTypes();
		const now = Date.now();
		for (const nt of builtins) {
			const slug = BUILTIN_SLUGS[nt.id];
			this.db.run(
				`INSERT OR IGNORE INTO note_types (id, name, type, fields_json, templates_json, css, is_builtin, slug, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
				[
					nt.id,
					nt.name,
					nt.type,
					JSON.stringify(nt.fields),
					JSON.stringify(nt.templates),
					nt.css,
					slug ?? null,
					now,
					now,
				],
			);
		}

		this.createFts5();
	}

	/**
	 * FTS5 full-text search on notes.fields_json.
	 * External content table — no data duplication, reads from notes via rowid.
	 * Wrapped in try/catch because FTS5 requires the extension compiled into the WASM binary.
	 */
	private createFts5(): void {
		try {
			// sql.js run() is a single-statement API — split each DDL statement into its own call
			this.db.run(`
				CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
					fields_json,
					content='notes',
					content_rowid='rowid'
				)
			`);

			this.db.run(`
				CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
					INSERT INTO notes_fts(rowid, fields_json) VALUES (new.rowid, new.fields_json);
				END
			`);

			this.db.run(`
				CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
					INSERT INTO notes_fts(notes_fts, rowid, fields_json) VALUES ('delete', old.rowid, old.fields_json);
				END
			`);

			this.db.run(`
				CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE OF fields_json ON notes BEGIN
					INSERT INTO notes_fts(notes_fts, rowid, fields_json) VALUES ('delete', old.rowid, old.fields_json);
					INSERT INTO notes_fts(rowid, fields_json) VALUES (new.rowid, new.fields_json);
				END
			`);

			// Rebuild index from existing data (idempotent — safe to run on every load)
			this.db.run(`INSERT INTO notes_fts(notes_fts) VALUES('rebuild')`);
			this.db.run(
				`INSERT OR REPLACE INTO meta (key, value) VALUES ('fts5_available', '1')`,
			);
		} catch (e) {
			console.warn(
				"[True Recall] FTS5 setup failed — falling back to LIKE queries.",
				e,
			);
			this.db.run(
				`INSERT OR REPLACE INTO meta (key, value) VALUES ('fts5_available', '0')`,
			);
		}
	}
}
