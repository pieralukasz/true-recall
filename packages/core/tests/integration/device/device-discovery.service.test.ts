import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	DeviceDiscoveryService,
	MAX_STATS_DB_BYTES,
} from "../../../src/integration/device/device-discovery.service";
import type { IPersistence } from "../../../src/interfaces/persistence";

const DB_FOLDER = ".true-recall";
const OWN_DB = `${DB_FOLDER}/true-recall-aaaaaaaa.db`;
const OTHER_DB = `${DB_FOLDER}/true-recall-bbbbbbbb.db`;

class MockPersistence implements IPersistence {
	files = new Map<string, { size: number; mtime: number }>();
	readBinary = vi.fn(async (_path: string): Promise<Uint8Array | null> => null);

	async read(_path: string): Promise<string> {
		throw new Error("not used");
	}

	async writeBinary(_path: string, _data: ArrayBuffer): Promise<void> {}

	async rename(_oldPath: string, _newPath: string): Promise<void> {}

	async exists(path: string): Promise<boolean> {
		if (this.files.has(path)) return true;
		const prefix = `${path}/`;
		return [...this.files.keys()].some((key) => key.startsWith(prefix));
	}

	async mkdir(_path: string): Promise<void> {}

	async list(path: string): Promise<{ files: string[]; folders: string[] }> {
		const prefix = `${path}/`;
		return {
			files: [...this.files.keys()].filter((key) => key.startsWith(prefix)),
			folders: [],
		};
	}

	async remove(path: string): Promise<void> {
		this.files.delete(path);
	}

	async stat(path: string): Promise<{ size: number; mtime: number } | null> {
		return this.files.get(path) ?? null;
	}

	seed(path: string, size: number, mtime = 1_700_000_000_000): void {
		this.files.set(path, { size, mtime });
	}
}

describe("DeviceDiscoveryService", () => {
	let persistence: MockPersistence;
	let service: DeviceDiscoveryService;

	beforeEach(() => {
		persistence = new MockPersistence();
		service = new DeviceDiscoveryService(persistence, "aaaaaaaa");
	});

	describe("discoverDeviceDatabases", () => {
		it("never reads database contents unless stats are requested", async () => {
			persistence.seed(OTHER_DB, 82 * 1024 * 1024);

			const databases = await service.discoverDeviceDatabases();

			expect(databases).toHaveLength(1);
			expect(databases[0]?.deviceId).toBe("bbbbbbbb");
			expect(databases[0]?.sizeBytes).toBe(82 * 1024 * 1024);
			expect(databases[0]?.cardCount).toBeNull();
			expect(databases[0]?.lastReviewDate).toBeNull();
			// Startup runs this on every device that has no database of its own;
			// reading an 80 MB file here froze plugin load on mobile.
			expect(persistence.readBinary).not.toHaveBeenCalled();
		});

		it("reads contents when stats are requested for a small database", async () => {
			persistence.seed(OTHER_DB, 1024);

			await service.discoverDeviceDatabases({ withStats: true });

			expect(persistence.readBinary).toHaveBeenCalledWith(OTHER_DB);
		});

		it("skips stats for databases too large to parse without stalling", async () => {
			persistence.seed(OTHER_DB, MAX_STATS_DB_BYTES + 1);

			const databases = await service.discoverDeviceDatabases({
				withStats: true,
			});

			expect(databases[0]?.cardCount).toBeNull();
			expect(persistence.readBinary).not.toHaveBeenCalled();
		});

		it("ignores sync conflict copies and sidecar files", async () => {
			persistence.seed(OWN_DB, 100);
			persistence.seed(`${DB_FOLDER}/true-recall-aaaaaaaa 2.db`, 100);
			persistence.seed(`${DB_FOLDER}/true-recall-aaaaaaaa.db 3.db`, 100);
			persistence.seed(`${DB_FOLDER}/true-recall-aaaaaaaa.db.db`, 100);
			persistence.seed(`${DB_FOLDER}/true-recall-aaaaaaaa.db.bak`, 100);
			persistence.seed(`${DB_FOLDER}/true-recall-aaaaaaaa.db.tmp`, 100);

			const databases = await service.discoverDeviceDatabases();

			expect(databases.map((db) => db.filename)).toEqual([
				"true-recall-aaaaaaaa.db",
			]);
			expect(databases[0]?.isCurrentDevice).toBe(true);
		});

		it("returns nothing when the database folder is missing", async () => {
			expect(await service.discoverDeviceDatabases()).toEqual([]);
		});

		it("sorts newest first", async () => {
			persistence.seed(OWN_DB, 100, 1_000);
			persistence.seed(OTHER_DB, 100, 2_000);

			const databases = await service.discoverDeviceDatabases();

			expect(databases.map((db) => db.deviceId)).toEqual([
				"bbbbbbbb",
				"aaaaaaaa",
			]);
		});
	});
});
