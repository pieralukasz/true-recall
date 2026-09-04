/**
 * Sync bookkeeping runs on every sync tick (startup, every minute, every
 * return from background). Writing unchanged watermarks dirties the store,
 * and a dirty store rewrites the whole database file. Only real changes may
 * touch the database.
 */
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudSyncMetaStore } from "../../../src/integration/cloud/cloud-sync-meta";
import { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import { MapPersistence } from "../../mocks/map-persistence.mock";
import { TestSqlJsWrapper } from "../../persistence/sqlite/__setup__/test-database";

async function createLoadedStore(): Promise<SqliteStoreService> {
	const store = new SqliteStoreService(new MapPersistence(), "dev12345");
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
	await store.load();
	return store;
}

describe("CloudSyncMetaStore", () => {
	beforeEach(() => {
		vi.spyOn(console, "debug").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("writes watermarks that changed and reads them back", async () => {
		const store = await createLoadedStore();
		const meta = new CloudSyncMetaStore(store, "acct");

		meta.writeNumber("push", 42);
		meta.writeNumber("cursor", 7);

		expect(meta.readNumber("push")).toBe(42);
		expect(meta.readNumber("cursor")).toBe(7);
	});

	it("does not touch the database when the bookkeeping is unchanged", async () => {
		const store = await createLoadedStore();
		const meta = new CloudSyncMetaStore(store, "acct");
		meta.writeNumber("push", 42);
		meta.writeNumber("cursor", 7);
		meta.writeAppliedVersions(new Map([["card:a", 5]]));
		meta.writePending(null);
		const run = vi.spyOn(store.getSqliteDb(), "run");

		meta.writeNumber("push", 42);
		meta.writeNumber("cursor", 7);
		meta.writeAppliedVersions(new Map([["card:a", 5]]));
		meta.writePending(null);

		expect(run).not.toHaveBeenCalled();
	});

	it("writes pending work and clears it once", async () => {
		const store = await createLoadedStore();
		const meta = new CloudSyncMetaStore(store, "acct");
		meta.writePending({ replay: ["card:a"], pulled: true });
		expect(meta.readPending()).toEqual({ replay: ["card:a"], pulled: true });

		const run = vi.spyOn(store.getSqliteDb(), "run");
		meta.writePending(null);
		meta.writePending(null);

		expect(run).toHaveBeenCalledTimes(1);
		expect(meta.readPending()).toEqual({ replay: [], pulled: false });
	});
});
