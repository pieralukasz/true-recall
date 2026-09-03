/**
 * A transaction that ran no write must not dirty the store. Cloud Sync wraps
 * every applied page in a transaction, including the empty page of an idle
 * sync tick; marking that dirty rewrote the whole database file every minute.
 */
import initSqlJs from "sql.js";
import { describe, expect, it, vi } from "vitest";

import { SqliteDatabase } from "../../../src/persistence/sqlite/SqliteDatabase";
import { TestSqlJsWrapper } from "./__setup__/test-database";

async function createDb(onDirty: () => void): Promise<SqliteDatabase> {
	const db = new SqliteDatabase(onDirty);
	const SQL = await initSqlJs();
	(db as unknown as { db: unknown }).db = new TestSqlJsWrapper(
		new SQL.Database(),
	);
	db.raw.run("CREATE TABLE t (v TEXT)");
	return db;
}

describe("SqliteDatabase.transaction dirty tracking", () => {
	it("does not mark the database dirty when the transaction wrote nothing", async () => {
		const onDirty = vi.fn();
		const db = await createDb(onDirty);

		const result = db.transaction(() =>
			db.query("SELECT count(*) AS n FROM t"),
		);

		expect(result).toEqual([{ n: 0 }]);
		expect(onDirty).not.toHaveBeenCalled();
	});

	it("marks the database dirty when the transaction wrote a row", async () => {
		const onDirty = vi.fn();
		const db = await createDb(onDirty);

		db.transaction(() => db.run("INSERT INTO t (v) VALUES (?)", ["x"]));

		expect(onDirty).toHaveBeenCalled();
		expect(db.get<{ n: number }>("SELECT count(*) AS n FROM t")).toEqual({
			n: 1,
		});
	});

	it("rolls back and rethrows when the callback throws", async () => {
		const db = await createDb(vi.fn());

		expect(() =>
			db.transaction(() => {
				db.run("INSERT INTO t (v) VALUES (?)", ["x"]);
				throw new Error("boom");
			}),
		).toThrow("boom");
		expect(db.get<{ n: number }>("SELECT count(*) AS n FROM t")).toEqual({
			n: 0,
		});
	});
});
