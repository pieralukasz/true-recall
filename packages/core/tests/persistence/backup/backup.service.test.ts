/**
 * BackupService Tests
 * New backups must land in the .nosync folder (excluded from iCloud
 * transfer) while archives in the legacy folder stay listed and restorable.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { IPersistence } from "../../../src/interfaces/persistence";
import { BackupService } from "../../../src/persistence/backup/backup.service";
import { gzipCompress } from "../../../src/persistence/backup/gzip.utils";
import type { SqliteStoreService } from "../../../src/persistence/sqlite";

class MapPersistence implements IPersistence {
	files = new Map<string, Uint8Array>();
	folders = new Set<string>();

	async rename(oldPath: string, newPath: string): Promise<void> {
		const data = this.files.get(oldPath);
		if (!data) throw new Error(`not found: ${oldPath}`);
		this.files.set(newPath, data);
		this.files.delete(oldPath);
	}

	async read(path: string): Promise<string> {
		const data = this.files.get(path);
		if (!data) throw new Error(`not found: ${path}`);
		return new TextDecoder().decode(data);
	}
	async readBinary(path: string): Promise<Uint8Array | null> {
		return this.files.get(path) ?? null;
	}
	async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
		this.files.set(path, new Uint8Array(data));
	}
	async exists(path: string): Promise<boolean> {
		if (this.folders.has(path)) return true;
		for (const key of this.files.keys()) {
			if (key.startsWith(`${path}/`)) return true;
		}
		return this.files.has(path);
	}
	async mkdir(path: string): Promise<void> {
		this.folders.add(path);
	}
	async list(path: string): Promise<{ files: string[]; folders: string[] }> {
		return {
			files: [...this.files.keys()].filter((key) => key.startsWith(`${path}/`)),
			folders: [],
		};
	}
	async remove(path: string): Promise<void> {
		this.files.delete(path);
	}
	async stat(path: string): Promise<{ size: number; mtime: number } | null> {
		const data = this.files.get(path);
		return data ? { size: data.byteLength, mtime: 0 } : null;
	}
}

function makeStoreMock(): SqliteStoreService {
	const sqliteHeader = new TextEncoder().encode(
		"SQLite format 3\0-------------------------",
	);
	return {
		getDeviceId: () => "dev00001",
		getDbPath: () => ".true-recall/true-recall-dev00001.db",
		saveNow: async () => true,
		getDatabase: () => ({ export: () => sqliteHeader }),
		haltPersistence: () => {},
	} as unknown as SqliteStoreService;
}

describe("BackupService folder layout", () => {
	let persistence: MapPersistence;
	let service: BackupService;

	beforeEach(() => {
		persistence = new MapPersistence();
		service = new BackupService(persistence, makeStoreMock());
	});

	it("writes new backups into the .nosync folder", async () => {
		const path = await service.createBackup();

		expect(path.startsWith(".true-recall/backups.nosync/dev00001/")).toBe(true);
	});

	it("lists backups from both the .nosync and the legacy folder", async () => {
		const gz = await gzipCompress(
			new TextEncoder().encode("SQLite format 3\0"),
		);
		persistence.files.set(
			".true-recall/backups.nosync/dev00001/true-recall-backup-2026-08-15-100000.db.gz",
			gz,
		);
		persistence.files.set(
			".true-recall/backups/dev00001/true-recall-backup-2026-08-14-100000.db.gz",
			gz,
		);

		const backups = await service.listBackups();

		expect(backups).toHaveLength(2);
		expect(backups[0]?.filename).toBe(
			"true-recall-backup-2026-08-15-100000.db.gz",
		);
		expect(backups[1]?.filename).toBe(
			"true-recall-backup-2026-08-14-100000.db.gz",
		);
	});
});

describe("BackupService restore", () => {
	it("replaces the live database atomically, keeping the previous file as .bak", async () => {
		const persistence = new MapPersistence();
		const service = new BackupService(persistence, makeStoreMock());
		const dbPath = ".true-recall/true-recall-dev00001.db";
		const backupPath =
			".true-recall/backups.nosync/dev00001/true-recall-backup-2026-08-15-100000.db.gz";

		const restoredBytes = new TextEncoder().encode(
			"SQLite format 3\0RESTORED-CONTENT",
		);
		persistence.files.set(backupPath, await gzipCompress(restoredBytes));
		const previousBytes = new TextEncoder().encode(
			"SQLite format 3\0PREVIOUS-CONTENT",
		);
		persistence.files.set(dbPath, previousBytes);

		const ok = await service.restoreFromBackup(backupPath);

		expect(ok).toBe(true);
		expect(persistence.files.get(dbPath)).toEqual(restoredBytes);
		expect(persistence.files.get(`${dbPath}.bak`)).toEqual(previousBytes);
		expect(persistence.files.has(`${dbPath}.tmp`)).toBe(false);
	});
});
