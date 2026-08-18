import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IPersistence } from "../../../src/interfaces/persistence";
import { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";

interface VacuumHarness {
	vacuumIfBloated: () => void;
}

function createStore(opts: {
	pageCount: number;
	freelistCount: number;
	pageSize?: number;
}) {
	const persistence: IPersistence = {
		exists: vi.fn(async () => true),
		mkdir: vi.fn(async () => {}),
		writeBinary: vi.fn(async () => {}),
		rename: vi.fn(async () => {}),
		readBinary: vi.fn(async () => null),
		read: vi.fn(async () => ""),
		list: vi.fn(async () => ({ files: [], folders: [] })),
		remove: vi.fn(async () => {}),
		stat: vi.fn(async () => null),
	};

	const executed: string[] = [];
	let pageCount = opts.pageCount;
	const pageSize = opts.pageSize ?? 4096;

	const dbStub = {
		isReady: () => true,
		query: (sql: string) => {
			if (sql.includes("page_count")) return [{ page_count: pageCount }];
			if (sql.includes("freelist_count"))
				return [{ freelist_count: opts.freelistCount }];
			if (sql.includes("page_size")) return [{ page_size: pageSize }];
			return [];
		},
		run: (sql: string) => {
			executed.push(sql);
			if (sql === "VACUUM") pageCount -= opts.freelistCount;
		},
	};

	const store = new SqliteStoreService(persistence, "dev12345");
	(store as unknown as { db: unknown }).db = dbStub;

	return { store: store as unknown as VacuumHarness, executed };
}

describe("SqliteStoreService vacuumIfBloated", () => {
	beforeEach(() => {
		vi.spyOn(console, "debug").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("vacuums when free pages exceed both byte and ratio thresholds", () => {
		// 38961 pages * 4096 = ~160MB file, 27223 free = ~111MB / 70% — the real
		// bloat profile this guard was written for
		const { store, executed } = createStore({
			pageCount: 38961,
			freelistCount: 27223,
		});

		store.vacuumIfBloated();

		expect(executed).toContain("VACUUM");
	});

	it.each([
		[
			"free ratio below threshold despite large free bytes",
			{ pageCount: 100_000, freelistCount: 2_000 }, // 8MB free but 2%
		],
		[
			"free bytes below threshold despite high ratio",
			{ pageCount: 1_000, freelistCount: 900 }, // 90% but only ~3.7MB
		],
		["empty database", { pageCount: 0, freelistCount: 0 }],
	])("skips VACUUM when %s", (_desc, opts) => {
		const { store, executed } = createStore(opts);

		store.vacuumIfBloated();

		expect(executed).not.toContain("VACUUM");
	});

	it("swallows errors instead of failing the load", () => {
		const { store } = createStore({ pageCount: 38961, freelistCount: 27223 });
		(store as unknown as { db: { run: (sql: string) => void } }).db.run =
			() => {
				throw new Error("VACUUM failed");
			};

		expect(() => store.vacuumIfBloated()).not.toThrow();
		expect(console.warn).toHaveBeenCalledOnce();
	});
});
