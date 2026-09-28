/**
 * Snapshot the database a released version creates, as a SQL fixture for
 * the schema upgrade tests (packages/core/tests/persistence/sqlite/
 * schema-upgrade.test.ts).
 *
 * Every schema change must still open databases written by older releases.
 * Tests that start from the current CREATE TABLE statements cannot see that:
 * 2.6.0 shipped an index on a column that existing databases did not have
 * yet, and every phone with a 2.5.x database failed to load. The fixtures
 * freeze what each release actually wrote, so the upgrade path is tested
 * against real old databases.
 *
 * Usage:
 *   bun scripts/snapshot-schema-fixture.ts <git-tag> [<git-tag> ...]
 *
 * The script extracts `packages/core/src` at the tag, runs that version's
 * SqliteSchemaManager.createTables() on an empty sql.js database, seeds a
 * few rows with the columns every release has, and writes
 * packages/core/tests/fixtures/schema-history/<tag>.sql.
 *
 * Run it for the last released tag whenever a release changes
 * SqliteSchemaManager.ts. The test fails when a released schema version
 * has no fixture.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import initSqlJs, { type Database } from "sql.js";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "packages/core/tests/fixtures/schema-history");
const SCHEMA_FILE =
	"packages/core/src/persistence/sqlite/SqliteSchemaManager.ts";

function sh(cmd: string[], cwd = ROOT): string {
	const result = Bun.spawnSync(cmd, { cwd, stderr: "pipe" });
	if (result.exitCode !== 0) {
		throw new Error(`${cmd.join(" ")}\n${result.stderr.toString()}`);
	}
	return result.stdout.toString();
}

function quote(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number") return String(value);
	if (value instanceof Uint8Array) {
		return `X'${Buffer.from(value).toString("hex")}'`;
	}
	return `'${String(value).replace(/'/g, "''")}'`;
}

/** Rows every release since 1.x can hold: only columns that never changed. */
function seedRows(db: Database): void {
	db.run(
		`INSERT INTO notes (id, note_type_id, fields_json, created_at, updated_at)
		 VALUES ('fixture-note', 'builtin-basic',
		         '{"Front":"Fixture question","Back":"Fixture answer"}',
		         1735689600000, 1735689600000)`,
	);
	db.run(
		`INSERT INTO cards (id, note_id, due, stability, difficulty, reps, lapses,
		                    state, last_review, created_at, updated_at)
		 VALUES ('fixture-card', 'fixture-note', '2025-01-10T00:00:00.000Z',
		         4.5, 5.2, 3, 1, 2, '2025-01-05T00:00:00.000Z',
		         1735689600000, 1735689600000)`,
	);
	db.run(
		`INSERT INTO review_log (id, card_id, reviewed_at, rating)
		 VALUES ('fixture-review', 'fixture-card', '2025-01-05T00:00:00.000Z', 3)`,
	);
}

/**
 * A plain SQL dump: schema objects in creation order, then the rows of
 * every table. sql.js has no `.dump`, and text keeps fixture diffs readable.
 */
function dump(db: Database): string {
	const lines: string[] = [];
	const objects = db.exec(
		`SELECT type, name, sql FROM sqlite_master
		 WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
		 ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, rowid`,
	)[0];
	const tables: string[] = [];
	for (const [type, name, sql] of objects?.values ?? []) {
		lines.push(`${sql};`);
		if (type === "table") tables.push(String(name));
	}
	for (const table of tables) {
		const rows = db.exec(`SELECT * FROM "${table}"`)[0];
		if (!rows) continue;
		const columns = rows.columns.map((c) => `"${c}"`).join(", ");
		for (const row of rows.values) {
			lines.push(
				`INSERT INTO "${table}" (${columns}) VALUES (${row.map(quote).join(", ")});`,
			);
		}
	}
	return `${lines.join("\n")}\n`;
}

async function snapshot(tag: string): Promise<void> {
	const commit = sh(["git", "rev-parse", "--short", `${tag}^{commit}`]).trim();
	const work = mkdtempSync(join(tmpdir(), "tr-schema-"));
	try {
		// Extract into node_modules/.cache so the old sources resolve `sql.js`
		// and TypeScript through this checkout's node_modules.
		const src = join(ROOT, "node_modules/.cache/tr-schema-fixture", tag);
		rmSync(src, { recursive: true, force: true });
		mkdirSync(src, { recursive: true });
		const archive = join(work, "src.tar");
		sh(["git", "archive", "-o", archive, tag, "packages/core/src"]);
		sh(["tar", "-xf", archive, "-C", src]);

		const mod = (await import(join(src, SCHEMA_FILE))) as {
			SqliteSchemaManager: new (db: unknown) => { createTables(): void };
		};
		const SQL = await initSqlJs();
		const db = new SQL.Database();
		const wrapper = {
			run: (sql: string, params?: unknown[]) => db.run(sql, params as never),
			exec: (sql: string) => db.exec(sql),
		};
		const warn = console.warn;
		console.warn = () => {}; // sql.js has no FTS5; every version falls back
		try {
			new mod.SqliteSchemaManager(wrapper).createTables();
		} finally {
			console.warn = warn;
		}
		seedRows(db);

		const version =
			db.exec("SELECT value FROM meta WHERE key = 'schema_version'")[0]
				?.values[0]?.[0] ?? "unknown";
		const header = [
			`-- Database created by True Recall ${tag} (${commit}), schema_version ${version}.`,
			"-- Generated by scripts/snapshot-schema-fixture.ts. Do not edit by hand.",
			"-- FTS5 tables are missing: sql.js cannot create them, and the upgrade",
			"-- code recreates them when it can.",
			"",
		].join("\n");
		mkdirSync(OUT_DIR, { recursive: true });
		const out = join(OUT_DIR, `${tag}.sql`);
		writeFileSync(out, header + dump(db));
		db.close();
		rmSync(src, { recursive: true, force: true });
		console.log(`${tag}: schema_version ${version} -> ${out}`);
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

const tags = process.argv.slice(2);
if (tags.length === 0) {
	console.error("usage: bun scripts/snapshot-schema-fixture.ts <git-tag> ...");
	process.exit(1);
}
for (const tag of tags) await snapshot(tag);
