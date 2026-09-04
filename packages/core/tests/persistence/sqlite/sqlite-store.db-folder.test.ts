import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import { MapPersistence } from "../../mocks/map-persistence.mock";
import { TestSqlJsWrapper } from "./__setup__/test-database";

const DEVICE_ID = "dev12345";

function createStore(
	persistence: MapPersistence,
	dbFolder?: string,
): SqliteStoreService {
	const store = new SqliteStoreService(persistence, DEVICE_ID, { dbFolder });
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

describe("SqliteStoreService dbFolder option", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "debug").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("defaults to the synced .true-recall folder", () => {
		const store = createStore(new MapPersistence());
		expect(store.getDbPath()).toBe(".true-recall/true-recall-dev12345.db");
	});

	it("uses the configured folder for the database path", () => {
		const store = createStore(
			new MapPersistence(),
			".true-recall/local.nosync",
		);
		expect(store.getDbPath()).toBe(
			".true-recall/local.nosync/true-recall-dev12345.db",
		);
	});

	it("creates every folder segment and writes the file there on flush", async () => {
		const fs = new MapPersistence();
		const mkdir = vi.spyOn(fs, "mkdir");
		const store = createStore(fs, ".true-recall/local.nosync");
		await store.load();

		await store.saveNow();

		expect(mkdir.mock.calls.map((c) => c[0])).toEqual([
			".true-recall",
			".true-recall/local.nosync",
		]);
		expect(
			fs.files.has(".true-recall/local.nosync/true-recall-dev12345.db"),
		).toBe(true);
		expect(fs.files.has(".true-recall/true-recall-dev12345.db")).toBe(false);
	});
});
