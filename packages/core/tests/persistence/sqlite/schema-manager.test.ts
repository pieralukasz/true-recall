/**
 * Upgrading a database created before a column existed.
 * CREATE TABLE IF NOT EXISTS skips existing tables, so any index on a new
 * column must run after its guarded ALTER TABLE.
 */
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import {
	CURRENT_SCHEMA_VERSION,
	SqliteSchemaManager,
} from "../../../src/persistence/sqlite/SqliteSchemaManager";
import { TestSqlJsWrapper } from "./__setup__/test-database";

/** The v3 cards table: everything v4 has except `flag`. */
const V3_CARDS = `
	CREATE TABLE cards (
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
		source_uid TEXT
	);
	INSERT INTO cards (id, note_id, due, reps) VALUES ('c1', 'n1', '2026-01-01T00:00:00Z', 5);
`;

describe("SqliteSchemaManager upgrade from v3", () => {
	it("adds cards.flag and its index to an existing v3 table without losing rows", async () => {
		const SQL = await initSqlJs();
		const raw = new SQL.Database();
		raw.run(V3_CARDS);
		const db = new TestSqlJsWrapper(raw);

		expect(() => new SqliteSchemaManager(db).createTables()).not.toThrow();

		const columns = db
			.exec("SELECT name FROM pragma_table_info('cards')")[0]
			?.values.map((row) => row[0]);
		expect(columns).toContain("flag");
		const indexes = db
			.exec("SELECT name FROM sqlite_master WHERE type = 'index'")[0]
			?.values.map((row) => row[0]);
		expect(indexes).toContain("idx_cards_flag");
		expect(
			db.exec("SELECT reps, flag FROM cards WHERE id = 'c1'")[0]?.values,
		).toEqual([[5, 0]]);
		expect(
			db.exec("SELECT value FROM meta WHERE key = 'schema_version'")[0]
				?.values[0]?.[0],
		).toBe(String(CURRENT_SCHEMA_VERSION));
		db.close();
	});
});
