/**
 * Loading an already-saved database must not dirty the store. On mobile a
 * dirty store means a full export and rewrite of the database file 400 ms
 * after startup; a 60 MB rewrite through the native bridge freezes the app
 * long enough for Android to show "Obsidian isn't responding".
 */
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import { BUILTIN_BASIC_ID } from "../../../src/types/note.types";
import { MapPersistence } from "../../mocks/map-persistence.mock";
import { TestSqlJsWrapper } from "./__setup__/test-database";

function createStore(fs: MapPersistence): SqliteStoreService {
	const store = new SqliteStoreService(fs, "dev12345");
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

async function createSavedDatabase(): Promise<MapPersistence> {
	const fs = new MapPersistence();
	const store = createStore(fs);
	await store.load();
	store.noteTypes.seedBuiltinTypes();
	await store.saveNow();
	return fs;
}

describe("SqliteStoreService load leaves a saved database clean", () => {
	beforeEach(() => {
		vi.spyOn(console, "debug").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("runs no write statements and stays clean when nothing changed", async () => {
		const fs = await createSavedDatabase();
		const store = createStore(fs);
		const run = vi.spyOn(store.getSqliteDb(), "run");

		await store.load();

		expect(run.mock.calls.map((c) => c[0])).toEqual([]);
		expect((store as unknown as { isDirty: boolean }).isDirty).toBe(false);
	});

	it("seeding builtins on a database that already has them runs no statements", async () => {
		const fs = await createSavedDatabase();
		const store = createStore(fs);
		await store.load();
		const run = vi.spyOn(store.getSqliteDb(), "run");

		store.noteTypes.seedBuiltinTypes();

		expect(run).not.toHaveBeenCalled();
		expect(store.noteTypes.getById(BUILTIN_BASIC_ID)?.name).toBe("Basic");
	});

	it("still repairs a builtin note type that drifted from the code", async () => {
		const fs = await createSavedDatabase();
		const store = createStore(fs);
		await store.load();
		store
			.getSqliteDb()
			.run(`UPDATE note_types SET name = 'Tampered' WHERE id = ?`, [
				BUILTIN_BASIC_ID,
			]);
		const run = vi.spyOn(store.getSqliteDb(), "run");

		store.noteTypes.refreshBuiltins();

		expect(run).toHaveBeenCalledTimes(1);
		expect(store.noteTypes.getById(BUILTIN_BASIC_ID)?.name).toBe("Basic");
	});
});
