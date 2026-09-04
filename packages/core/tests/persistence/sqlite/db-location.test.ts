import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	getDbFolder,
	getDeviceDbPath,
	LOCAL_DB_FOLDER,
	migrateDeviceDbLocation,
	resolveDbLocation,
} from "../../../src/persistence/sqlite/db-location";
import { DB_FOLDER } from "../../../src/persistence/sqlite/sqlite.types";
import { MapPersistence } from "../../mocks/map-persistence.mock";

const DEVICE_ID = "dev12345";
const SHARED = `.true-recall/true-recall-${DEVICE_ID}.db`;
const LOCAL = `.true-recall/local.nosync/true-recall-${DEVICE_ID}.db`;
/** A plausible database body: the migration refuses anything shorter than a SQLite header. */
const bytes = (marker: string) =>
	new TextEncoder().encode(marker.padEnd(256, "."));

describe("db-location resolver", () => {
	it("keeps shared-vault databases in the synced folder", () => {
		expect(resolveDbLocation("shared-vault")).toBe("shared");
	});

	it("moves cloud and off databases out of the synced folder", () => {
		expect(resolveDbLocation("cloud")).toBe("local");
		expect(resolveDbLocation("off")).toBe("local");
	});

	it("maps locations to folders", () => {
		expect(getDbFolder("shared")).toBe(DB_FOLDER);
		expect(getDbFolder("local")).toBe(LOCAL_DB_FOLDER);
		expect(LOCAL_DB_FOLDER).toBe(".true-recall/local.nosync");
	});

	it("builds the device database path inside a folder", () => {
		expect(getDeviceDbPath("dev12345", DB_FOLDER)).toBe(
			".true-recall/true-recall-dev12345.db",
		);
		expect(getDeviceDbPath("dev12345", LOCAL_DB_FOLDER)).toBe(
			".true-recall/local.nosync/true-recall-dev12345.db",
		);
	});
});

describe("migrateDeviceDbLocation", () => {
	beforeEach(() => {
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("returns the target folder when the file is already there", async () => {
		const fs = new MapPersistence();
		fs.files.set(LOCAL, bytes("local"));
		fs.files.set(SHARED, bytes("stale-shared"));

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			LOCAL_DB_FOLDER,
		);
		expect(fs.files.get(SHARED)).toEqual(bytes("stale-shared"));
	});

	it("moves main, .tmp and .bak out of the synced folder", async () => {
		const fs = new MapPersistence();
		fs.files.set(SHARED, bytes("main"));
		fs.files.set(`${SHARED}.tmp`, bytes("tmp"));
		fs.files.set(`${SHARED}.bak`, bytes("bak"));

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			LOCAL_DB_FOLDER,
		);
		expect(fs.files.get(LOCAL)).toEqual(bytes("main"));
		expect(fs.files.get(`${LOCAL}.tmp`)).toEqual(bytes("tmp"));
		expect(fs.files.get(`${LOCAL}.bak`)).toEqual(bytes("bak"));
		expect(fs.files.has(SHARED)).toBe(false);
		expect(fs.files.has(`${SHARED}.tmp`)).toBe(false);
		expect(fs.files.has(`${SHARED}.bak`)).toBe(false);
	});

	it("copies the bytes instead of renaming the file", async () => {
		const fs = new MapPersistence();
		fs.files.set(SHARED, bytes("main"));
		const rename = vi.spyOn(fs, "rename");
		const readBinary = vi.spyOn(fs, "readBinary");

		await migrateDeviceDbLocation(fs, DEVICE_ID, "local");

		expect(rename).not.toHaveBeenCalled();
		expect(readBinary).toHaveBeenCalledWith(SHARED);
		expect(fs.files.get(LOCAL)).toEqual(bytes("main"));
	});

	it("moves a lone main file without failing on missing siblings", async () => {
		const fs = new MapPersistence();
		fs.files.set(SHARED, bytes("main"));

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			LOCAL_DB_FOLDER,
		);
		expect(fs.files.get(LOCAL)).toEqual(bytes("main"));
		expect([...fs.files.keys()]).toEqual([LOCAL]);
	});

	it("moves back into the synced folder for shared-vault", async () => {
		const fs = new MapPersistence();
		fs.files.set(LOCAL, bytes("main"));

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "shared")).toBe(
			DB_FOLDER,
		);
		expect(fs.files.get(SHARED)).toEqual(bytes("main"));
		expect(fs.files.has(LOCAL)).toBe(false);
	});

	it("falls back to the old folder when the main copy cannot be written", async () => {
		const fs = new MapPersistence();
		fs.files.set(SHARED, bytes("main"));
		fs.files.set(`${SHARED}.bak`, bytes("bak"));
		vi.spyOn(fs, "writeBinary").mockRejectedValue(new Error("EPERM"));

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			DB_FOLDER,
		);
		expect(fs.files.get(SHARED)).toEqual(bytes("main"));
		expect(fs.files.get(`${SHARED}.bak`)).toEqual(bytes("bak"));
		expect(fs.files.has(LOCAL)).toBe(false);
	});

	it("leaves an unreadable database where it is", async () => {
		// An iCloud placeholder whose bytes are not on the device right now.
		const fs = new MapPersistence();
		fs.files.set(SHARED, bytes("main"));
		fs.files.set(`${SHARED}.tmp`, bytes("newest"));
		vi.spyOn(fs, "readBinary").mockResolvedValue(null);

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			DB_FOLDER,
		);
		expect(fs.files.get(SHARED)).toEqual(bytes("main"));
		expect(fs.files.get(`${SHARED}.tmp`)).toEqual(bytes("newest"));
		expect(fs.files.has(LOCAL)).toBe(false);
		expect(fs.files.has(`${LOCAL}.tmp`)).toBe(false);
	});

	it("refuses to migrate a file shorter than a SQLite header", async () => {
		const fs = new MapPersistence();
		fs.files.set(SHARED, new Uint8Array(0));

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			DB_FOLDER,
		);
		expect(fs.files.has(SHARED)).toBe(true);
		expect(fs.files.has(LOCAL)).toBe(false);
	});

	it("keeps the original and discards a torn copy", async () => {
		const fs = new MapPersistence();
		fs.files.set(SHARED, bytes("main"));
		fs.truncateWritesTo = 120;

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			DB_FOLDER,
		);
		expect(fs.files.get(SHARED)).toEqual(bytes("main"));
		expect(fs.files.has(LOCAL)).toBe(false);
	});

	it("keeps a sibling whose copy fails and still finishes the main move", async () => {
		const fs = new MapPersistence();
		fs.files.set(SHARED, bytes("main"));
		fs.files.set(`${SHARED}.bak`, bytes("bak"));
		const readBinary = fs.readBinary.bind(fs);
		vi.spyOn(fs, "readBinary").mockImplementation(async (path) =>
			path === `${SHARED}.bak` ? null : readBinary(path),
		);

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			LOCAL_DB_FOLDER,
		);
		expect(fs.files.get(LOCAL)).toEqual(bytes("main"));
		expect(fs.files.has(SHARED)).toBe(false);
		expect(fs.files.get(`${SHARED}.bak`)).toEqual(bytes("bak"));
		expect(fs.files.has(`${LOCAL}.bak`)).toBe(false);
	});

	it("returns the target folder and writes nothing when no file exists", async () => {
		const fs = new MapPersistence();
		const writeBinary = vi.spyOn(fs, "writeBinary");
		const mkdir = vi.spyOn(fs, "mkdir");

		expect(await migrateDeviceDbLocation(fs, DEVICE_ID, "local")).toBe(
			LOCAL_DB_FOLDER,
		);
		expect(writeBinary).not.toHaveBeenCalled();
		expect(mkdir).not.toHaveBeenCalled();
	});

	it("creates every missing folder segment before copying", async () => {
		const fs = new MapPersistence();
		fs.files.set(SHARED, bytes("main"));
		const mkdir = vi.spyOn(fs, "mkdir");

		await migrateDeviceDbLocation(fs, DEVICE_ID, "local");

		expect(mkdir.mock.calls.map((c) => c[0])).toEqual([
			".true-recall",
			".true-recall/local.nosync",
		]);
	});
});
