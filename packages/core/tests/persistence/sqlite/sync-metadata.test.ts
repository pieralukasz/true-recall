import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import { MapPersistence } from "../../mocks/map-persistence.mock";
import { TestSqlJsWrapper } from "./__setup__/test-database";

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

describe("setSyncMetadataIfChanged", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "debug").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("writes a new value and reports the change", async () => {
		const store = await createLoadedStore();
		expect(store.cards.setSyncMetadataIfChanged("device:label", "iPhone")).toBe(
			true,
		);
		expect(store.cards.getSyncMetadata("device:label")).toBe("iPhone");
	});

	it("does not touch the database when the value is unchanged", async () => {
		const store = await createLoadedStore();
		store.cards.setSyncMetadata("device:label", "iPhone");
		const run = vi.spyOn(store.getSqliteDb(), "run");

		expect(store.cards.setSyncMetadataIfChanged("device:label", "iPhone")).toBe(
			false,
		);
		expect(run).not.toHaveBeenCalled();
	});
});
