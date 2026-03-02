/**
 * Migration v25 → v26 — Integration Tests
 *
 * The most critical test file: validates the migration that converts
 * flat question/answer cards into the notes+cards separation model.
 *
 * Uses a v25-schema in-memory database, runs the migration,
 * and verifies all data integrity post-migration.
 */
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import type {
	BindParams,
	DatabaseLike,
	QueryExecResult,
} from "../../../../src/features/core/persistence/sqlite/loader";
import { migration025ToV26 } from "../../../../src/features/core/persistence/sqlite/migrations/migration-025-to-v26";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "../../../../src/shared/types/note.types";

// ── V25 test database ──────────────────────────────────────────

class V25SqlJsWrapper implements DatabaseLike {
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

function createV25Schema(db: DatabaseLike): void {
	db.run(`
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
			created_via TEXT DEFAULT 'manual',
			source_text TEXT,
			fsrs_preset TEXT
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

		CREATE TABLE IF NOT EXISTS meta (
			key TEXT PRIMARY KEY NOT NULL,
			value TEXT
		);

		INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '25');
	`);
}

// ── Helpers ────────────────────────────────────────────────────

let cardCounter = 0;

function insertV25Card(
	db: DatabaseLike,
	overrides: Record<string, unknown> = {},
): string {
	cardCounter++;
	const id = (overrides.id as string) ?? `v25-card-${cardCounter}`;
	const now = new Date().toISOString();

	db.run(
		`INSERT INTO cards (
			id, due, stability, difficulty, reps, lapses, state,
			last_review, scheduled_days, learning_step, suspended,
			created_at, updated_at,
			question, answer, source_uid, card_type,
			cloze_template, cloze_index, reverse_of,
			io_image_path, io_regions_json, io_group_key, io_parent_id,
			created_via, source_text, fsrs_preset
		) VALUES (
			?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?,
			?, ?,
			?, ?, ?, ?,
			?, ?, ?,
			?, ?, ?, ?,
			?, ?, ?
		)`,
		[
			id,
			(overrides.due as string) ?? now,
			(overrides.stability as number) ?? 0,
			(overrides.difficulty as number) ?? 0,
			(overrides.reps as number) ?? 0,
			(overrides.lapses as number) ?? 0,
			(overrides.state as number) ?? State.New,
			(overrides.last_review as string) ?? null,
			(overrides.scheduled_days as number) ?? 0,
			(overrides.learning_step as number) ?? 0,
			(overrides.suspended as number) ?? 0,
			(overrides.created_at as number) ?? Date.now(),
			(overrides.updated_at as number) ?? Date.now(),
			(overrides.question as string) ?? `Question ${cardCounter}`,
			(overrides.answer as string) ?? `Answer ${cardCounter}`,
			(overrides.source_uid as string) ?? null,
			(overrides.card_type as string) ?? "basic",
			(overrides.cloze_template as string) ?? null,
			(overrides.cloze_index as number) ?? null,
			(overrides.reverse_of as string) ?? null,
			(overrides.io_image_path as string) ?? null,
			(overrides.io_regions_json as string) ?? null,
			(overrides.io_group_key as string) ?? null,
			(overrides.io_parent_id as string) ?? null,
			(overrides.created_via as string) ?? "manual",
			(overrides.source_text as string) ?? null,
			(overrides.fsrs_preset as string) ?? null,
		],
	);

	return id;
}

function queryAll<T>(db: DatabaseLike, sql: string, params: BindParams = []): T[] {
	const result = db.exec(sql, params);
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

function queryOne<T>(db: DatabaseLike, sql: string, params: BindParams = []): T | null {
	const results = queryAll<T>(db, sql, params);
	return results[0] ?? null;
}

function getSchemaVersion(db: DatabaseLike): string | null {
	const row = queryOne<{ value: string }>(
		db,
		`SELECT value FROM meta WHERE key = 'schema_version'`,
	);
	return row?.value ?? null;
}

function tableExists(db: DatabaseLike, name: string): boolean {
	const row = queryOne<{ count: number }>(
		db,
		`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
		[name],
	);
	return (row?.count ?? 0) > 0;
}

function columnExists(db: DatabaseLike, table: string, column: string): boolean {
	const rows = queryAll<{ name: string }>(db, `PRAGMA table_info(${table})`);
	return rows.some((r) => r.name === column);
}

// ── Tests ──────────────────────────────────────────────────────

describe("Migration v25 → v26", () => {
	let rawDb: SqlJsDatabase;
	let db: DatabaseLike;

	beforeEach(async () => {
		const SQL = await initSqlJs();
		rawDb = new SQL.Database();
		db = new V25SqlJsWrapper(rawDb);
		createV25Schema(db);
	});

	afterEach(() => {
		rawDb.close();
	});

	// ── Schema changes ─────────────────────────────────────────

	describe("schema changes", () => {
		it("creates note_types table", () => {
			migration025ToV26(db);
			expect(tableExists(db, "note_types")).toBe(true);
		});

		it("creates notes table", () => {
			migration025ToV26(db);
			expect(tableExists(db, "notes")).toBe(true);
		});

		it("cards table has note_id and template_ord columns", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "note_id")).toBe(true);
			expect(columnExists(db, "cards", "template_ord")).toBe(true);
		});

		it("cards table does NOT have question column", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "question")).toBe(false);
		});

		it("cards table does NOT have answer column", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "answer")).toBe(false);
		});

		it("cards table does NOT have card_type column", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "card_type")).toBe(false);
		});

		it("cards table does NOT have cloze_template column", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "cloze_template")).toBe(false);
		});

		it("cards table does NOT have cloze_index column", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "cloze_index")).toBe(false);
		});

		it("cards table does NOT have reverse_of column", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "reverse_of")).toBe(false);
		});

		it("cards table does NOT have io_image_path column", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "io_image_path")).toBe(false);
		});

		it("cards table does NOT have io_regions_json column", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "io_regions_json")).toBe(false);
		});

		it("cards table does NOT have source_text column (moved to notes)", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "source_text")).toBe(false);
		});

		it("cards table does NOT have created_via column (moved to notes)", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "created_via")).toBe(false);
		});

		it("cards table KEEPS source_uid (denormalized)", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "source_uid")).toBe(true);
		});

		it("cards table KEEPS fsrs_preset", () => {
			migration025ToV26(db);
			expect(columnExists(db, "cards", "fsrs_preset")).toBe(true);
		});

		it("schema_version updated to 26", () => {
			migration025ToV26(db);
			expect(getSchemaVersion(db)).toBe("26");
		});
	});

	// ── Built-in note types seeded ─────────────────────────────

	describe("built-in note types seeded", () => {
		it("4 built-in note types exist after migration", () => {
			migration025ToV26(db);
			const types = queryAll<{ id: string }>(
				db,
				`SELECT id FROM note_types WHERE is_builtin = 1`,
			);
			expect(types).toHaveLength(4);
		});

		it("builtin-basic: correct fields and template", () => {
			migration025ToV26(db);
			const row = queryOne<{ fields_json: string; templates_json: string }>(
				db,
				`SELECT fields_json, templates_json FROM note_types WHERE id = ?`,
				[BUILTIN_BASIC_ID],
			);
			expect(row).not.toBeNull();
			const fields = JSON.parse(row!.fields_json);
			expect(fields).toEqual(["Front", "Back"]);
			const templates = JSON.parse(row!.templates_json);
			expect(templates).toHaveLength(1);
		});

		it("builtin-basic-reversed: 2 templates", () => {
			migration025ToV26(db);
			const row = queryOne<{ templates_json: string }>(
				db,
				`SELECT templates_json FROM note_types WHERE id = ?`,
				[BUILTIN_BASIC_REVERSED_ID],
			);
			const templates = JSON.parse(row!.templates_json);
			expect(templates).toHaveLength(2);
		});

		it("builtin-cloze: type=1", () => {
			migration025ToV26(db);
			const row = queryOne<{ type: number }>(
				db,
				`SELECT type FROM note_types WHERE id = ?`,
				[BUILTIN_CLOZE_ID],
			);
			expect(row!.type).toBe(1);
		});
	});

	// ── Basic card migration ───────────────────────────────────

	describe("basic card migration", () => {
		it("basic card → note with {Front: question, Back: answer}", () => {
			insertV25Card(db, {
				id: "basic-1",
				question: "What is ATP?",
				answer: "Adenosine triphosphate",
				card_type: "basic",
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["basic-1"],
			);
			expect(card!.note_id).toBeDefined();

			const note = queryOne<{ fields_json: string; note_type_id: string }>(
				db,
				`SELECT fields_json, note_type_id FROM notes WHERE id = ?`,
				[card!.note_id],
			);
			expect(note!.note_type_id).toBe(BUILTIN_BASIC_ID);

			const fields = JSON.parse(note!.fields_json);
			expect(fields.Front).toBe("What is ATP?");
			expect(fields.Back).toBe("Adenosine triphosphate");
		});

		it("basic card → card.template_ord = 0", () => {
			insertV25Card(db, { id: "basic-ord", card_type: "basic" });

			migration025ToV26(db);

			const card = queryOne<{ template_ord: number }>(
				db,
				`SELECT template_ord FROM cards WHERE id = ?`,
				["basic-ord"],
			);
			expect(card!.template_ord).toBe(0);
		});

		it("note.source_uid = card's original source_uid", () => {
			insertV25Card(db, {
				id: "basic-src",
				source_uid: "uid-xyz",
				card_type: "basic",
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["basic-src"],
			);
			const note = queryOne<{ source_uid: string }>(
				db,
				`SELECT source_uid FROM notes WHERE id = ?`,
				[card!.note_id],
			);
			expect(note!.source_uid).toBe("uid-xyz");
		});

		it("note.source_text = card's original source_text", () => {
			insertV25Card(db, {
				id: "basic-st",
				source_text: "# My Note\n#flashcard",
				card_type: "basic",
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["basic-st"],
			);
			const note = queryOne<{ source_text: string }>(
				db,
				`SELECT source_text FROM notes WHERE id = ?`,
				[card!.note_id],
			);
			expect(note!.source_text).toBe("# My Note\n#flashcard");
		});

		it("FSRS data preserved: stability, difficulty, reps, lapses, state", () => {
			insertV25Card(db, {
				id: "basic-fsrs",
				card_type: "basic",
				stability: 5.5,
				difficulty: 4.2,
				reps: 3,
				lapses: 1,
				state: State.Review,
			});

			migration025ToV26(db);

			const card = queryOne<{
				stability: number;
				difficulty: number;
				reps: number;
				lapses: number;
				state: number;
			}>(db, `SELECT stability, difficulty, reps, lapses, state FROM cards WHERE id = ?`, [
				"basic-fsrs",
			]);
			expect(card!.stability).toBeCloseTo(5.5);
			expect(card!.difficulty).toBeCloseTo(4.2);
			expect(card!.reps).toBe(3);
			expect(card!.lapses).toBe(1);
			expect(card!.state).toBe(State.Review);
		});

		it("suspended/buried state preserved", () => {
			insertV25Card(db, {
				id: "basic-susp",
				card_type: "basic",
				suspended: 1,
			});

			migration025ToV26(db);

			const card = queryOne<{ suspended: number }>(
				db,
				`SELECT suspended FROM cards WHERE id = ?`,
				["basic-susp"],
			);
			expect(card!.suspended).toBe(1);
		});

		it("card with NULL question → note with {Front: '', Back: ''}", () => {
			insertV25Card(db, {
				id: "basic-null",
				question: null,
				answer: null,
				card_type: "basic",
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["basic-null"],
			);
			const note = queryOne<{ fields_json: string }>(
				db,
				`SELECT fields_json FROM notes WHERE id = ?`,
				[card!.note_id],
			);
			const fields = JSON.parse(note!.fields_json);
			expect(fields.Front).toBe("");
			expect(fields.Back).toBe("");
		});

		it("100 basic cards → 100 notes + 100 cards (1:1)", () => {
			for (let i = 0; i < 100; i++) {
				insertV25Card(db, {
					id: `bulk-${i}`,
					question: `Q${i}`,
					answer: `A${i}`,
					card_type: "basic",
				});
			}

			migration025ToV26(db);

			const noteCount = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM notes`,
			);
			const cardCount = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM cards`,
			);
			expect(noteCount!.cnt).toBe(100);
			expect(cardCount!.cnt).toBe(100);
		});
	});

	// ── Reversed pair migration ────────────────────────────────

	describe("reversed pair migration", () => {
		it("original + reversed → 1 note with type builtin-basic-reversed", () => {
			insertV25Card(db, {
				id: "orig-1",
				question: "Dog",
				answer: "Perro",
				card_type: "basic",
			});
			insertV25Card(db, {
				id: "rev-1",
				question: "Perro",
				answer: "Dog",
				card_type: "reversed",
				reverse_of: "orig-1",
			});

			migration025ToV26(db);

			const orig = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["orig-1"],
			);
			const rev = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["rev-1"],
			);
			// Both should point to same note
			expect(orig!.note_id).toBe(rev!.note_id);

			const note = queryOne<{ note_type_id: string }>(
				db,
				`SELECT note_type_id FROM notes WHERE id = ?`,
				[orig!.note_id],
			);
			expect(note!.note_type_id).toBe(BUILTIN_BASIC_REVERSED_ID);
		});

		it("original card → template_ord=0, reversed → template_ord=1", () => {
			insertV25Card(db, { id: "ro-1", card_type: "basic" });
			insertV25Card(db, {
				id: "rr-1",
				card_type: "reversed",
				reverse_of: "ro-1",
			});

			migration025ToV26(db);

			const orig = queryOne<{ template_ord: number }>(
				db,
				`SELECT template_ord FROM cards WHERE id = ?`,
				["ro-1"],
			);
			const rev = queryOne<{ template_ord: number }>(
				db,
				`SELECT template_ord FROM cards WHERE id = ?`,
				["rr-1"],
			);
			expect(orig!.template_ord).toBe(0);
			expect(rev!.template_ord).toBe(1);
		});

		it("orphaned reversed card (original deleted) → treated as builtin-basic", () => {
			insertV25Card(db, {
				id: "orphan-rev",
				question: "Orphan",
				answer: "Answer",
				card_type: "reversed",
				reverse_of: "deleted-orig",
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string; template_ord: number }>(
				db,
				`SELECT note_id, template_ord FROM cards WHERE id = ?`,
				["orphan-rev"],
			);
			const note = queryOne<{ note_type_id: string }>(
				db,
				`SELECT note_type_id FROM notes WHERE id = ?`,
				[card!.note_id],
			);
			expect(note!.note_type_id).toBe(BUILTIN_BASIC_ID);
		});
	});

	// ── Cloze card migration ───────────────────────────────────

	describe("cloze card migration", () => {
		it("3 cloze siblings → 1 note", () => {
			const template = "{{c1::H2O}} is {{c2::water}} and {{c3::essential}}";
			insertV25Card(db, {
				id: "cz-1",
				card_type: "cloze",
				cloze_template: template,
				cloze_index: 1,
				source_uid: "cloze-src",
			});
			insertV25Card(db, {
				id: "cz-2",
				card_type: "cloze",
				cloze_template: template,
				cloze_index: 2,
				source_uid: "cloze-src",
			});
			insertV25Card(db, {
				id: "cz-3",
				card_type: "cloze",
				cloze_template: template,
				cloze_index: 3,
				source_uid: "cloze-src",
			});

			migration025ToV26(db);

			const card1 = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["cz-1"],
			);
			const card2 = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["cz-2"],
			);
			const card3 = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["cz-3"],
			);

			// All 3 share same note
			expect(card1!.note_id).toBe(card2!.note_id);
			expect(card2!.note_id).toBe(card3!.note_id);
		});

		it("note type = builtin-cloze", () => {
			insertV25Card(db, {
				id: "cz-type",
				card_type: "cloze",
				cloze_template: "{{c1::test}}",
				cloze_index: 1,
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["cz-type"],
			);
			const note = queryOne<{ note_type_id: string }>(
				db,
				`SELECT note_type_id FROM notes WHERE id = ?`,
				[card!.note_id],
			);
			expect(note!.note_type_id).toBe(BUILTIN_CLOZE_ID);
		});

		it("note fields = {Text: cloze_template, Extra: ''}", () => {
			const template = "{{c1::Paris}} is the capital";
			insertV25Card(db, {
				id: "cz-fields",
				card_type: "cloze",
				cloze_template: template,
				cloze_index: 1,
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["cz-fields"],
			);
			const note = queryOne<{ fields_json: string }>(
				db,
				`SELECT fields_json FROM notes WHERE id = ?`,
				[card!.note_id],
			);
			const fields = JSON.parse(note!.fields_json);
			expect(fields.Text).toBe(template);
			expect(fields.Extra).toBe("");
		});

		it("each card → template_ord = original cloze_index", () => {
			insertV25Card(db, {
				id: "cz-ord-1",
				card_type: "cloze",
				cloze_template: "{{c1::a}} {{c2::b}}",
				cloze_index: 1,
				source_uid: "cz-ord-src",
			});
			insertV25Card(db, {
				id: "cz-ord-2",
				card_type: "cloze",
				cloze_template: "{{c1::a}} {{c2::b}}",
				cloze_index: 2,
				source_uid: "cz-ord-src",
			});

			migration025ToV26(db);

			const c1 = queryOne<{ template_ord: number }>(
				db,
				`SELECT template_ord FROM cards WHERE id = ?`,
				["cz-ord-1"],
			);
			const c2 = queryOne<{ template_ord: number }>(
				db,
				`SELECT template_ord FROM cards WHERE id = ?`,
				["cz-ord-2"],
			);
			expect(c1!.template_ord).toBe(1);
			expect(c2!.template_ord).toBe(2);
		});

		it("cloze cards with different templates → separate notes", () => {
			insertV25Card(db, {
				id: "cz-diff-1",
				card_type: "cloze",
				cloze_template: "{{c1::A}}",
				cloze_index: 1,
				source_uid: "same-src",
			});
			insertV25Card(db, {
				id: "cz-diff-2",
				card_type: "cloze",
				cloze_template: "{{c1::B}} different",
				cloze_index: 1,
				source_uid: "same-src",
			});

			migration025ToV26(db);

			const c1 = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["cz-diff-1"],
			);
			const c2 = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["cz-diff-2"],
			);
			// Different templates → different notes
			expect(c1!.note_id).not.toBe(c2!.note_id);
		});
	});

	// ── Image-occlusion migration ──────────────────────────────

	describe("image-occlusion migration", () => {
		it("parent + children → 1 note with type builtin-image-occlusion", () => {
			const regions = JSON.stringify([{ id: "r1" }, { id: "r2" }]);
			insertV25Card(db, {
				id: "io-parent",
				card_type: "image-occlusion",
				io_image_path: "img.png",
				io_regions_json: regions,
			});
			insertV25Card(db, {
				id: "io-child-1",
				card_type: "image-occlusion",
				io_parent_id: "io-parent",
				io_group_key: "1",
			});
			insertV25Card(db, {
				id: "io-child-2",
				card_type: "image-occlusion",
				io_parent_id: "io-parent",
				io_group_key: "2",
			});

			migration025ToV26(db);

			const parent = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["io-parent"],
			);
			const child1 = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["io-child-1"],
			);
			const child2 = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["io-child-2"],
			);

			// All point to same note
			expect(parent!.note_id).toBe(child1!.note_id);
			expect(child1!.note_id).toBe(child2!.note_id);

			const note = queryOne<{ note_type_id: string; fields_json: string }>(
				db,
				`SELECT note_type_id, fields_json FROM notes WHERE id = ?`,
				[parent!.note_id],
			);
			expect(note!.note_type_id).toBe(BUILTIN_IMAGE_OCCLUSION_ID);

			const fields = JSON.parse(note!.fields_json);
			expect(fields.Image).toBe("img.png");
			expect(fields.Regions).toBe(regions);
		});
	});

	// ── Data integrity post-migration ──────────────────────────

	describe("data integrity post-migration", () => {
		it("zero cards with note_id IS NULL", () => {
			insertV25Card(db, { card_type: "basic" });
			insertV25Card(db, { card_type: "basic" });

			migration025ToV26(db);

			const orphans = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM cards WHERE note_id IS NULL`,
			);
			expect(orphans!.cnt).toBe(0);
		});

		it("every card.note_id references an existing note", () => {
			insertV25Card(db, { card_type: "basic" });
			insertV25Card(db, { card_type: "basic" });

			migration025ToV26(db);

			const broken = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM cards c
				 LEFT JOIN notes n ON c.note_id = n.id
				 WHERE n.id IS NULL`,
			);
			expect(broken!.cnt).toBe(0);
		});

		it("every note.note_type_id references an existing note_type", () => {
			insertV25Card(db, { card_type: "basic" });

			migration025ToV26(db);

			const broken = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM notes n
				 LEFT JOIN note_types nt ON n.note_type_id = nt.id
				 WHERE nt.id IS NULL`,
			);
			expect(broken!.cnt).toBe(0);
		});

		it("total card count unchanged", () => {
			insertV25Card(db, { card_type: "basic" });
			insertV25Card(db, { card_type: "basic" });
			insertV25Card(db, { card_type: "basic" });

			const beforeCount = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM cards`,
			);

			migration025ToV26(db);

			const afterCount = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM cards`,
			);
			expect(afterCount!.cnt).toBe(beforeCount!.cnt);
		});

		it("no duplicate note IDs", () => {
			for (let i = 0; i < 10; i++) {
				insertV25Card(db, { id: `dup-${i}`, card_type: "basic" });
			}

			migration025ToV26(db);

			const dupes = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM (
					SELECT id FROM notes GROUP BY id HAVING COUNT(*) > 1
				)`,
			);
			expect(dupes!.cnt).toBe(0);
		});
	});

	// ── Mixed database migration ───────────────────────────────

	describe("mixed database migration", () => {
		it("DB with basic + reversed + cloze + IO → correct note counts", () => {
			// 3 basic cards
			insertV25Card(db, { id: "mix-b1", card_type: "basic" });
			insertV25Card(db, { id: "mix-b2", card_type: "basic" });
			insertV25Card(db, { id: "mix-b3", card_type: "basic" });

			// 1 reversed pair
			insertV25Card(db, { id: "mix-ro", card_type: "basic" });
			insertV25Card(db, {
				id: "mix-rr",
				card_type: "reversed",
				reverse_of: "mix-ro",
			});

			// 1 cloze group (2 cards)
			const clozeT = "{{c1::a}} {{c2::b}}";
			insertV25Card(db, {
				id: "mix-cz1",
				card_type: "cloze",
				cloze_template: clozeT,
				cloze_index: 1,
				source_uid: "mix-cz-src",
			});
			insertV25Card(db, {
				id: "mix-cz2",
				card_type: "cloze",
				cloze_template: clozeT,
				cloze_index: 2,
				source_uid: "mix-cz-src",
			});

			migration025ToV26(db);

			// Expected notes: 3 basic + 1 reversed pair + 1 cloze group = 5
			const noteCount = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM notes`,
			);
			expect(noteCount!.cnt).toBe(5);

			// Total cards unchanged: 3 + 2 + 2 = 7
			const cardCount = queryOne<{ cnt: number }>(
				db,
				`SELECT COUNT(*) as cnt FROM cards`,
			);
			expect(cardCount!.cnt).toBe(7);
		});
	});

	// ── Edge cases ─────────────────────────────────────────────

	describe("edge cases", () => {
		it("empty database (0 cards) → migration succeeds, 4 built-in types exist", () => {
			migration025ToV26(db);

			const types = queryAll<{ id: string }>(
				db,
				`SELECT id FROM note_types WHERE is_builtin = 1`,
			);
			expect(types).toHaveLength(4);
		});

		it("card with all NULL optional fields → migrates cleanly", () => {
			insertV25Card(db, {
				id: "null-card",
				question: null,
				answer: null,
				source_uid: null,
				source_text: null,
				cloze_template: null,
				cloze_index: null,
				reverse_of: null,
				card_type: "basic",
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["null-card"],
			);
			expect(card!.note_id).toBeDefined();
		});

		it("cards with very long question/answer (10KB+) → field data preserved", () => {
			const longQ = "Q".repeat(10_000);
			const longA = "A".repeat(10_000);
			insertV25Card(db, {
				id: "long-card",
				question: longQ,
				answer: longA,
				card_type: "basic",
			});

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["long-card"],
			);
			const note = queryOne<{ fields_json: string }>(
				db,
				`SELECT fields_json FROM notes WHERE id = ?`,
				[card!.note_id],
			);
			const fields = JSON.parse(note!.fields_json);
			expect(fields.Front).toHaveLength(10_000);
			expect(fields.Back).toHaveLength(10_000);
		});

		it("deleted cards (deleted_at set) → still migrated", () => {
			insertV25Card(db, {
				id: "deleted-card",
				card_type: "basic",
			});
			db.run(
				`UPDATE cards SET deleted_at = ? WHERE id = ?`,
				[Date.now(), "deleted-card"],
			);

			migration025ToV26(db);

			const card = queryOne<{ note_id: string }>(
				db,
				`SELECT note_id FROM cards WHERE id = ?`,
				["deleted-card"],
			);
			expect(card!.note_id).toBeDefined();
		});
	});
});
