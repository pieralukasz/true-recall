/**
 * Test Database Setup
 * In-memory SQLite database for fast, isolated tests
 */
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { State } from "ts-fsrs";
import type {
	BindParams,
	DatabaseLike,
	QueryExecResult,
} from "../../../../src/persistence/sqlite/loader";
import { CardActions } from "../../../../src/persistence/sqlite/modules/CardActions";
import { NoteActions } from "../../../../src/persistence/sqlite/modules/NoteActions";
import {
	getBuiltinNoteTypes,
	NoteTypeActions,
} from "../../../../src/persistence/sqlite/modules/NoteTypeActions";
import { StatsActions } from "../../../../src/persistence/sqlite/modules/StatsActions";
import type { FSRSCardData } from "../../../../src/types";
import type { Note, NoteType } from "../../../../src/types/note.types";
import { BUILTIN_SLUGS } from "../../../../src/types/note.types";

class TestSqlJsWrapper implements DatabaseLike {
	constructor(private sqlDb: SqlJsDatabase) {}

	exec(sql: string, params?: BindParams): QueryExecResult[] {
		if (!params || params.length === 0) {
			return this.sqlDb.exec(sql) as QueryExecResult[];
		}
		const stmt = this.sqlDb.prepare(sql);
		stmt.bind(params);
		const results: QueryExecResult[] = [];
		const columns: string[] = stmt.getColumnNames();
		const values: (string | number | null | Uint8Array)[][] = [];
		while (stmt.step()) {
			values.push(stmt.get() as (string | number | null | Uint8Array)[]);
		}
		if (columns.length > 0) {
			results.push({ columns, values });
		}
		stmt.free();
		return results;
	}

	run(sql: string, params?: BindParams): void {
		this.sqlDb.run(sql, params);
	}

	export(): Uint8Array {
		return this.sqlDb.export();
	}

	close(): void {
		this.sqlDb.close();
	}

	getRowsModified(): number {
		return this.sqlDb.getRowsModified();
	}
}

export class TestSqliteDatabase {
	private db: DatabaseLike | null = null;
	private dirtyCallback: () => void;

	constructor(onDirty?: () => void) {
		this.dirtyCallback = onDirty ?? (() => {});
	}

	async init(): Promise<void> {
		const SQL = await initSqlJs();
		this.db = new TestSqlJsWrapper(new SQL.Database());
		this.createSchema();
	}

	private createSchema(): void {
		if (!this.db) throw new Error("Database not initialized");

		this.db.run(`
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

			CREATE INDEX IF NOT EXISTS idx_notes_note_type ON notes(note_type_id);
			CREATE INDEX IF NOT EXISTS idx_notes_source_uid ON notes(source_uid);
			CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at);
			CREATE INDEX IF NOT EXISTS idx_cards_note_id ON cards(note_id);
			CREATE INDEX IF NOT EXISTS idx_cards_note_template ON cards(note_id, template_ord);
			CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
			CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
			CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid);
			CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at);
			CREATE INDEX IF NOT EXISTS idx_revlog_preset_date ON review_log(deleted_at, preset_name, reviewed_at);

			INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1');
		`);
	}

	seedBuiltinNoteTypes(): void {
		const builtins = getBuiltinNoteTypes();
		const now = Date.now();
		for (const nt of builtins) {
			const slug = BUILTIN_SLUGS[nt.id];
			this.run(
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
	}

	query<T extends object>(sql: string, params: BindParams = []): T[] {
		if (!this.db) throw new Error("Database not initialized");
		const result = this.db.exec(sql, params);
		if (result.length === 0) return [];
		const { columns, values } = result[0]!;
		return values.map((row) => {
			const obj: Record<string, unknown> = {};
			columns.forEach((col, i) => {
				obj[col] = row[i];
			});
			return obj as T;
		});
	}

	get<T extends object>(sql: string, params: BindParams = []): T | null {
		const results = this.query<T>(sql, params);
		return results[0] || null;
	}

	run(sql: string, params: BindParams = []): void {
		if (!this.db) throw new Error("Database not initialized");
		this.db.run(sql, params);
		this.dirtyCallback();
	}

	runMany(statements: [string, BindParams][]): void {
		if (!this.db) throw new Error("Database not initialized");
		for (const [sql, params] of statements) {
			this.db.run(sql, params);
		}
		this.dirtyCallback();
	}

	transaction<T>(fn: () => T): T {
		if (!this.db) throw new Error("Database not initialized");
		try {
			this.db.run("BEGIN TRANSACTION");
			const result = fn();
			this.db.run("COMMIT");
			this.dirtyCallback();
			return result;
		} catch (e) {
			this.db.run("ROLLBACK");
			throw e;
		}
	}

	getRowsModified(): number {
		if (!this.db) return 0;
		return this.db.getRowsModified();
	}

	get raw(): DatabaseLike {
		if (!this.db) throw new Error("Database not initialized");
		return this.db;
	}

	isReady(): boolean {
		return this.db !== null;
	}

	close(): void {
		this.db?.close();
		this.db = null;
	}
}

// ── Test context ───────────────────────────────────────────────

export interface TestContext {
	db: TestSqliteDatabase;
	cards: CardActions;
	stats: StatsActions;
	noteTypes: NoteTypeActions;
	notes: NoteActions;
	close: () => void;
}

export async function createTestContext(): Promise<TestContext> {
	const db = new TestSqliteDatabase();
	await db.init();

	const cards = new CardActions(db as never);
	const stats = new StatsActions(db as never);
	const noteTypes = new NoteTypeActions(db as never);
	const notes = new NoteActions(db as never);

	// Seed builtin note types (required for CardActions.set() which uses BUILTIN_BASIC_ID)
	db.seedBuiltinNoteTypes();

	return {
		db,
		cards,
		stats,
		noteTypes,
		notes,
		close: () => db.close(),
	};
}

// ── Card test factories ────────────────────────────────────────

export function createTestCard(
	overrides: Partial<FSRSCardData> = {},
): FSRSCardData {
	const now = new Date();
	const id = overrides.id ?? `card-${Math.random().toString(36).slice(2, 10)}`;

	return {
		id,
		due: overrides.due ?? now.toISOString(),
		stability: overrides.stability ?? 0,
		difficulty: overrides.difficulty ?? 0,
		reps: overrides.reps ?? 0,
		lapses: overrides.lapses ?? 0,
		state: overrides.state ?? State.New,
		lastReview: overrides.lastReview ?? null,
		scheduledDays: overrides.scheduledDays ?? 0,
		learningStep: overrides.learningStep ?? 0,
		suspended: overrides.suspended ?? false,
		buriedUntil: overrides.buriedUntil,
		createdAt: overrides.createdAt ?? Date.now(),
		question: overrides.question ?? `Question for ${id}`,
		answer: overrides.answer ?? `Answer for ${id}`,
		sourceUid: overrides.sourceUid,
		sourceText: overrides.sourceText,
	};
}

export function createCardWithSource(
	sourceUid: string,
	overrides: Partial<FSRSCardData> = {},
): FSRSCardData {
	return createTestCard({
		...overrides,
		sourceUid,
	});
}

export function createOrphanedCard(
	overrides: Partial<FSRSCardData> = {},
): FSRSCardData {
	return createTestCard({
		...overrides,
		sourceUid: undefined,
	});
}

export function insertCardDirect(cards: CardActions, card: FSRSCardData): void {
	cards.set(card.id, card);
}

export function getRawCard(
	db: TestSqliteDatabase,
	cardId: string,
): Record<string, unknown> | null {
	return db.get<Record<string, unknown>>(`SELECT * FROM cards WHERE id = ?`, [
		cardId,
	]);
}

// ── Note type test factories ───────────────────────────────────

let noteTypeCounter = 0;

export function createTestNoteType(
	overrides: Partial<NoteType> = {},
): NoteType {
	noteTypeCounter++;
	return {
		id: overrides.id ?? `test-note-type-${noteTypeCounter}`,
		name: overrides.name ?? `Test Note Type ${noteTypeCounter}`,
		type: overrides.type ?? 0,
		fields: overrides.fields ?? ["Front", "Back"],
		templates: overrides.templates ?? [
			{
				name: "Card 1",
				ordinal: 0,
				qfmt: "{{Front}}",
				afmt: "{{Back}}",
			},
		],
		css: overrides.css ?? "",
		isBuiltin: overrides.isBuiltin ?? false,
		createdAt: overrides.createdAt ?? Date.now(),
		updatedAt: overrides.updatedAt ?? Date.now(),
	};
}

let noteCounter = 0;

export function createTestNote(overrides: Partial<Note> = {}): Note {
	noteCounter++;
	return {
		id: overrides.id ?? `test-note-${noteCounter}`,
		noteTypeId: overrides.noteTypeId ?? "builtin-basic",
		fields: overrides.fields ?? {
			Front: `Question ${noteCounter}`,
			Back: `Answer ${noteCounter}`,
		},
		tags: overrides.tags ?? [],
		sourceUid: overrides.sourceUid,
		sourceText: overrides.sourceText,
		createdVia: overrides.createdVia ?? "manual",
		createdAt: overrides.createdAt ?? Date.now(),
		updatedAt: overrides.updatedAt ?? Date.now(),
	};
}

// ── Direct SQL helpers for verification ────────────────────────

export function insertNoteTypeDirect(
	db: TestSqliteDatabase,
	noteType: NoteType,
): void {
	db.run(
		`INSERT INTO note_types (id, name, type, fields_json, templates_json, css, is_builtin, slug, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			noteType.id,
			noteType.name,
			noteType.type,
			JSON.stringify(noteType.fields),
			JSON.stringify(noteType.templates),
			noteType.css,
			noteType.isBuiltin ? 1 : 0,
			noteType.slug ?? null,
			noteType.createdAt ?? null,
			noteType.updatedAt ?? null,
		],
	);
}

export function insertNoteDirect(db: TestSqliteDatabase, note: Note): void {
	db.run(
		`INSERT INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			note.id,
			note.noteTypeId,
			JSON.stringify(note.fields),
			note.tags.join(" "),
			note.sourceUid ?? null,
			note.sourceText ?? null,
			note.createdVia ?? "manual",
			note.createdAt ?? null,
			note.updatedAt ?? null,
		],
	);
}

export function getRawNoteType(
	db: TestSqliteDatabase,
	id: string,
): Record<string, unknown> | null {
	return db.get<Record<string, unknown>>(
		`SELECT * FROM note_types WHERE id = ?`,
		[id],
	);
}

export function getRawNote(
	db: TestSqliteDatabase,
	id: string,
): Record<string, unknown> | null {
	return db.get<Record<string, unknown>>(`SELECT * FROM notes WHERE id = ?`, [
		id,
	]);
}
