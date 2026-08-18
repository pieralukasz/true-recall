import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	getDbBakPath,
	getDbCorruptedPath,
	getDbTmpPath,
	loadDbFileWithSalvage,
	writeDbFileAtomically,
} from "../../../src/persistence/sqlite/atomic-db-file";
import { MapPersistence } from "../../mocks/map-persistence.mock";

const DB_PATH = ".true-recall/true-recall-dev12345.db";

/** Bytes that pass the SQLite header validation, tagged for identification. */
function makeDbBytes(tag: number): Uint8Array {
	const bytes = new Uint8Array(120);
	bytes.set(new TextEncoder().encode("SQLite format 3\0"), 0);
	bytes[100] = tag;
	return bytes;
}

function tagOf(bytes: Uint8Array): number {
	return bytes[100] ?? -1;
}

describe("writeDbFileAtomically", () => {
	it("swaps the new data into place and keeps the previous file as .bak", async () => {
		const fs = new MapPersistence();
		const oldData = makeDbBytes(1);
		const newData = makeDbBytes(2);
		fs.files.set(DB_PATH, oldData);

		await writeDbFileAtomically(fs, DB_PATH, newData.slice().buffer);

		expect(tagOf(fs.files.get(DB_PATH) ?? new Uint8Array())).toBe(2);
		expect(tagOf(fs.files.get(getDbBakPath(DB_PATH)) ?? new Uint8Array())).toBe(
			1,
		);
		expect(fs.files.has(getDbTmpPath(DB_PATH))).toBe(false);
	});

	it("creates the file without a .bak when no previous file exists", async () => {
		const fs = new MapPersistence();
		const newData = makeDbBytes(2);

		await writeDbFileAtomically(fs, DB_PATH, newData.slice().buffer);

		expect(tagOf(fs.files.get(DB_PATH) ?? new Uint8Array())).toBe(2);
		expect(fs.files.has(getDbBakPath(DB_PATH))).toBe(false);
		expect(fs.files.has(getDbTmpPath(DB_PATH))).toBe(false);
	});

	it("replaces a stale .bak from a previous flush", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, makeDbBytes(2));
		fs.files.set(getDbBakPath(DB_PATH), makeDbBytes(1));

		await writeDbFileAtomically(fs, DB_PATH, makeDbBytes(3).slice().buffer);

		expect(tagOf(fs.files.get(DB_PATH) ?? new Uint8Array())).toBe(3);
		expect(tagOf(fs.files.get(getDbBakPath(DB_PATH)) ?? new Uint8Array())).toBe(
			2,
		);
	});

	it("throws on a torn write and leaves the previous file untouched", async () => {
		const fs = new MapPersistence();
		const oldData = makeDbBytes(1);
		fs.files.set(DB_PATH, oldData);
		fs.truncateWritesTo = 16;

		await expect(
			writeDbFileAtomically(fs, DB_PATH, makeDbBytes(2).slice().buffer),
		).rejects.toThrow(/truncated/i);

		expect(tagOf(fs.files.get(DB_PATH) ?? new Uint8Array())).toBe(1);
		expect(fs.files.has(getDbBakPath(DB_PATH))).toBe(false);
		expect(fs.files.has(getDbTmpPath(DB_PATH))).toBe(false);
	});
});

describe("loadDbFileWithSalvage", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function acceptTags(...tags: number[]) {
		const initialized: (number | null)[] = [];
		const tryInit = async (bytes: Uint8Array | null): Promise<void> => {
			if (bytes === null) {
				initialized.push(null);
				return;
			}
			if (!tags.includes(tagOf(bytes))) {
				throw new Error(`corrupt payload (tag ${tagOf(bytes)})`);
			}
			initialized.push(tagOf(bytes));
		};
		return { tryInit, initialized };
	}

	it("loads the main file on a clean startup", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, makeDbBytes(1));
		const { tryInit, initialized } = acceptTags(1);

		const outcome = await loadDbFileWithSalvage(fs, DB_PATH, tryInit);

		expect(outcome).toEqual({ source: "main", salvaged: false });
		expect(initialized).toEqual([1]);
	});

	it("initializes a fresh database when no files exist", async () => {
		const fs = new MapPersistence();
		const { tryInit, initialized } = acceptTags();

		const outcome = await loadDbFileWithSalvage(fs, DB_PATH, tryInit);

		expect(outcome).toEqual({ source: "fresh", salvaged: false });
		expect(initialized).toEqual([null]);
	});

	it("prefers a complete leftover .tmp over the older main file", async () => {
		// Crash between writing .tmp and the final rename: .tmp holds the
		// newest complete flush, main is one flush behind.
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, makeDbBytes(1));
		fs.files.set(getDbTmpPath(DB_PATH), makeDbBytes(2));
		const { tryInit } = acceptTags(1, 2);

		const outcome = await loadDbFileWithSalvage(fs, DB_PATH, tryInit);

		expect(outcome).toEqual({ source: "tmp", salvaged: true });
		// Main was valid, so it must not be moved aside as corrupted.
		expect(fs.files.has(getDbCorruptedPath(DB_PATH))).toBe(false);
		expect(fs.files.has(DB_PATH)).toBe(true);
	});

	it("falls back to main and discards a torn .tmp", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, makeDbBytes(1));
		fs.files.set(getDbTmpPath(DB_PATH), new Uint8Array([1, 2, 3])); // torn write
		const { tryInit } = acceptTags(1);

		const outcome = await loadDbFileWithSalvage(fs, DB_PATH, tryInit);

		expect(outcome).toEqual({ source: "main", salvaged: false });
		expect(fs.files.has(getDbTmpPath(DB_PATH))).toBe(false);
	});

	it("salvages from .bak when main is corrupted and preserves the corrupt file", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, makeDbBytes(9)); // header ok, content corrupt
		fs.files.set(getDbBakPath(DB_PATH), makeDbBytes(1));
		const { tryInit } = acceptTags(1);

		const outcome = await loadDbFileWithSalvage(fs, DB_PATH, tryInit);

		expect(outcome).toEqual({ source: "bak", salvaged: true });
		expect(fs.files.has(DB_PATH)).toBe(false);
		expect(
			tagOf(fs.files.get(getDbCorruptedPath(DB_PATH)) ?? new Uint8Array()),
		).toBe(9);
	});

	it("salvages a header-truncated main file (the 512KB scenario)", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, new Uint8Array([0x53, 0x51])); // 2 bytes of garbage
		fs.files.set(getDbBakPath(DB_PATH), makeDbBytes(1));
		const { tryInit } = acceptTags(1);

		const outcome = await loadDbFileWithSalvage(fs, DB_PATH, tryInit);

		expect(outcome).toEqual({ source: "bak", salvaged: true });
	});

	it("throws when every candidate is corrupt so callers can restore from backups", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, makeDbBytes(9));
		fs.files.set(getDbBakPath(DB_PATH), makeDbBytes(8));
		const { tryInit } = acceptTags();

		await expect(loadDbFileWithSalvage(fs, DB_PATH, tryInit)).rejects.toThrow();
	});

	it("replaces an older .corrupted file when moving the main file aside", async () => {
		const fs = new MapPersistence();
		fs.files.set(DB_PATH, makeDbBytes(9));
		fs.files.set(getDbCorruptedPath(DB_PATH), makeDbBytes(7));
		fs.files.set(getDbBakPath(DB_PATH), makeDbBytes(1));
		const { tryInit } = acceptTags(1);

		await loadDbFileWithSalvage(fs, DB_PATH, tryInit);

		expect(
			tagOf(fs.files.get(getDbCorruptedPath(DB_PATH)) ?? new Uint8Array()),
		).toBe(9);
	});
});
