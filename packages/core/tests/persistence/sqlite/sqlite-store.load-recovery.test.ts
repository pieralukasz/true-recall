/**
 * End-to-end persistence safety of SqliteStoreService: crash-safe flush and
 * load-time salvage of the newest intact database copy. Uses real sql.js
 * databases as file fixtures so header validation, the consistency probe,
 * and corruption behave like production.
 */
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	getDbBakPath,
	getDbCorruptedPath,
	getDbTmpPath,
} from "../../../src/persistence/sqlite/atomic-db-file";
import { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import { MapPersistence } from "../../mocks/map-persistence.mock";
import { TestSqlJsWrapper } from "./__setup__/test-database";

const DEVICE_ID = "dev12345";
const DB_PATH = `.true-recall/true-recall-${DEVICE_ID}.db`;

async function exportDbWithMarker(marker: string): Promise<Uint8Array> {
	const SQL = await initSqlJs();
	const db = new SQL.Database();
	db.run("CREATE TABLE test_marker (value TEXT NOT NULL)");
	db.run("INSERT INTO test_marker (value) VALUES (?)", [marker]);
	const bytes = db.export();
	db.close();
	return bytes;
}

/**
 * Store whose SqliteDatabase opens file bytes through sql.js instead of the
 * wasm loader (which is unavailable in vitest).
 */
function createStore(persistence: MapPersistence): SqliteStoreService {
	const store = new SqliteStoreService(persistence, DEVICE_ID);
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

function readMarker(store: SqliteStoreService): string | null {
	const row = store
		.getSqliteDb()
		.get<{ value: string }>("SELECT value FROM test_marker");
	return row?.value ?? null;
}

describe("SqliteStoreService load recovery", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads a healthy main file without touching other copies", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, await exportDbWithMarker("healthy"));
		const store = createStore(fs);

		await store.load();

		expect(readMarker(store)).toBe("healthy");
		expect(fs.files.has(getDbCorruptedPath(DB_PATH))).toBe(false);
		await store.close();
	});

	it("salvages from .bak when the main file is truncated (the 512KB incident)", async () => {
		const fs = new MapPersistence();
		const truncated = (await exportDbWithMarker("lost")).slice(0, 512);
		fs.files.set(DB_PATH, truncated);
		fs.files.set(getDbBakPath(DB_PATH), await exportDbWithMarker("previous"));
		const store = createStore(fs);

		await store.load();

		expect(readMarker(store)).toBe("previous");
		// The truncated file is preserved for diagnostics, not silently deleted.
		expect(fs.files.get(getDbCorruptedPath(DB_PATH))?.byteLength).toBe(512);
		await store.close();
		// close() flushes, so the salvaged data is re-persisted as the main file.
		expect(fs.files.get(DB_PATH)?.byteLength).toBeGreaterThan(512);
	});

	it("prefers a complete leftover .tmp flush over the older main file", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, await exportDbWithMarker("older-flush"));
		fs.files.set(
			getDbTmpPath(DB_PATH),
			await exportDbWithMarker("newest-flush"),
		);
		const store = createStore(fs);

		await store.load();

		expect(readMarker(store)).toBe("newest-flush");
		await store.close();
	});

	it("detects a size mismatch even when the file still opens (consistency probe)", async () => {
		const fs = new MapPersistence();
		const healthy = await exportDbWithMarker("padded");
		const padded = new Uint8Array(healthy.byteLength + 4096);
		padded.set(healthy, 0);
		fs.files.set(DB_PATH, padded);
		fs.files.set(getDbBakPath(DB_PATH), await exportDbWithMarker("previous"));
		const store = createStore(fs);

		await store.load();

		expect(readMarker(store)).toBe("previous");
		await store.close();
	});

	it("throws when every copy is corrupt so plugin-level backup restore can run", async () => {
		const fs = new MapPersistence();
		const bytes = await exportDbWithMarker("gone");
		fs.files.set(DB_PATH, bytes.slice(0, 512));
		fs.files.set(getDbBakPath(DB_PATH), bytes.slice(0, 256));
		const store = createStore(fs);

		await expect(store.load()).rejects.toThrow();
	});

	it("starts a fresh database when no files exist", async () => {
		const fs = new MapPersistence();
		const store = createStore(fs);

		await store.load();

		expect(store.isReady()).toBe(true);
		await store.close();
		expect(fs.files.get(DB_PATH)?.byteLength ?? 0).toBeGreaterThan(0);
	});
});

describe("SqliteStoreService atomic flush", () => {
	beforeEach(() => {
		vi.spyOn(console, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("rotates the previous file to .bak and leaves no .tmp behind", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, await exportDbWithMarker("gen-1"));
		const store = createStore(fs);
		await store.load();
		const previousBytes = fs.files.get(DB_PATH);

		store.getSqliteDb().run("INSERT INTO test_marker (value) VALUES ('gen-2')");
		await store.flush();

		expect(fs.files.get(getDbBakPath(DB_PATH))).toEqual(previousBytes);
		expect(fs.files.get(DB_PATH)?.byteLength ?? 0).toBeGreaterThan(0);
		expect(fs.files.get(DB_PATH)).not.toEqual(previousBytes);
		expect(fs.files.has(getDbTmpPath(DB_PATH))).toBe(false);
		await store.close();
	});

	it("keeps the previous main file intact when the write is torn", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, await exportDbWithMarker("gen-1"));
		const store = createStore(fs);
		await store.load();
		const previousBytes = fs.files.get(DB_PATH);
		fs.truncateWritesTo = 512;

		store.getSqliteDb().run("INSERT INTO test_marker (value) VALUES ('gen-2')");
		vi.spyOn(console, "error").mockImplementation(() => {});
		const flushed = await store.saveNow({ bestEffort: true });

		expect(flushed).toBe(false);
		expect(fs.files.get(DB_PATH)).toEqual(previousBytes);
		expect(fs.files.has(getDbTmpPath(DB_PATH))).toBe(false);
	});
});
