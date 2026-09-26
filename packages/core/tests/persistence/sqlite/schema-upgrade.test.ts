/**
 * Every released database must open on the current code.
 *
 * Each fixture in tests/fixtures/schema-history is the database a released
 * version created, generated from that version's own source by
 * scripts/snapshot-schema-fixture.ts. Loading it runs the real upgrade path
 * (SqliteStoreService.load: CREATE TABLE IF NOT EXISTS against old tables,
 * guarded ALTER TABLEs, integrity check, builtin refresh).
 *
 * Tests that start from an empty database only see the newest CREATE TABLE
 * statements. That is how 2.6.0 shipped an index on a column that existing
 * databases did not have yet: every database created by 2.5.1 or earlier,
 * on mobile and desktop, failed to load with "no such column: flag".
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_SCHEMA_VERSION } from "../../../src/persistence/sqlite/SqliteSchemaManager";
import { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import { MapPersistence } from "../../mocks/map-persistence.mock";
import { TestSqlJsWrapper } from "./__setup__/test-database";

const FIXTURE_DIR = join(import.meta.dirname, "../../fixtures/schema-history");

interface Fixture {
	release: string;
	schemaVersion: number;
	sql: string;
}

function loadFixtures(): Fixture[] {
	return readdirSync(FIXTURE_DIR)
		.filter((file) => file.endsWith(".sql"))
		.map((file) => {
			const sql = readFileSync(join(FIXTURE_DIR, file), "utf8");
			const version = /schema_version (\d+)\./.exec(sql)?.[1];
			if (!version) throw new Error(`${file}: header has no schema_version`);
			return {
				release: file.replace(/\.sql$/, ""),
				schemaVersion: Number(version),
				sql,
			};
		});
}

const fixtures = loadFixtures();

async function databaseBytes(sql?: string): Promise<Uint8Array> {
	const SQL = await initSqlJs();
	const db = new SQL.Database();
	if (sql) db.exec(sql);
	const bytes = db.export();
	db.close();
	return bytes;
}

/** A store on an in-memory filesystem, backed by sql.js instead of the WASM build. */
function createStore(fs: MapPersistence): SqliteStoreService {
	const store = new SqliteStoreService(fs, "fixture1");
	const sqliteDb = store.getSqliteDb();
	(
		sqliteDb as unknown as {
			init: (bytes: Uint8Array | null) => Promise<void>;
		}
	).init = async (bytes) => {
		const SQL = await initSqlJs();
		const raw = bytes ? new SQL.Database(bytes) : new SQL.Database();
		(sqliteDb as unknown as { db: unknown }).db = new TestSqlJsWrapper(raw);
	};
	return store;
}

async function openStore(sql?: string): Promise<SqliteStoreService> {
	const fs = new MapPersistence();
	const store = createStore(fs);
	if (sql) fs.files.set(store.getDbPath(), await databaseBytes(sql));
	await store.load();
	return store;
}

/** Table -> sorted column names, plus index names: what a query can rely on. */
function schemaShape(store: SqliteStoreService): {
	columns: Record<string, string[]>;
	indexes: string[];
} {
	const db = store.getSqliteDb();
	const tables = db
		.query<{ name: string }>(
			`SELECT name FROM sqlite_master
			 WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%fts%'`,
		)
		.map((row) => row.name)
		.sort();
	const columns: Record<string, string[]> = {};
	for (const table of tables) {
		columns[table] = db
			.query<{ name: string }>(`SELECT name FROM pragma_table_info('${table}')`)
			.map((row) => row.name)
			.sort();
	}
	const indexes = db
		.query<{ name: string }>(
			`SELECT name FROM sqlite_master
			 WHERE type = 'index' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%fts%'`,
		)
		.map((row) => row.name)
		.sort();
	return { columns, indexes };
}

describe("databases from released versions", () => {
	beforeEach(() => {
		vi.spyOn(console, "debug").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("has a fixture for every schema version before the current one", () => {
		const covered = new Set(fixtures.map((f) => f.schemaVersion));
		const missing: number[] = [];
		for (let v = 1; v < CURRENT_SCHEMA_VERSION; v++) {
			if (!covered.has(v)) missing.push(v);
		}
		// Bumped CURRENT_SCHEMA_VERSION? Snapshot the last release first:
		// bun scripts/snapshot-schema-fixture.ts <last-tag>
		expect(missing).toEqual([]);
	});

	describe.each(fixtures)("$release (schema v$schemaVersion)", (fixture) => {
		it("loads through the real startup path", async () => {
			const store = await openStore(fixture.sql);

			const version = store
				.getSqliteDb()
				.get<{ value: string }>(
					"SELECT value FROM meta WHERE key = 'schema_version'",
				);
			expect(version?.value).toBe(String(CURRENT_SCHEMA_VERSION));
		});

		it("keeps the note, card and review it was saved with", async () => {
			const store = await openStore(fixture.sql);
			const db = store.getSqliteDb();

			expect(
				db.get("SELECT fields_json FROM notes WHERE id = 'fixture-note'"),
			).toEqual({
				fields_json: '{"Front":"Fixture question","Back":"Fixture answer"}',
			});
			expect(
				db.get(
					`SELECT due, stability, reps, lapses, state
					 FROM cards WHERE id = 'fixture-card'`,
				),
			).toEqual({
				due: "2025-01-10T00:00:00.000Z",
				stability: 4.5,
				reps: 3,
				lapses: 1,
				state: 2,
			});
			expect(
				db.get("SELECT rating FROM review_log WHERE id = 'fixture-review'"),
			).toEqual({ rating: 3 });
			expect(store.cards.get("fixture-card")?.reps).toBe(3);
		});

		it("ends up with the same tables, columns and indexes as a new database", async () => {
			const upgraded = schemaShape(await openStore(fixture.sql));
			const fresh = schemaShape(await openStore());

			expect(upgraded.columns).toEqual(fresh.columns);
			expect(upgraded.indexes).toEqual(fresh.indexes);
		});

		it("opens again after being saved on the current version", async () => {
			const fs = new MapPersistence();
			const first = createStore(fs);
			fs.files.set(first.getDbPath(), await databaseBytes(fixture.sql));
			await first.load();
			await first.saveNow();

			const second = createStore(fs);
			await second.load();

			expect(second.cards.get("fixture-card")?.reps).toBe(3);
		});
	});
});
