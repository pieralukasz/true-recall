/**
 * DeviceSyncService Tests
 *
 * Integration tests for multi-device sync startup behavior.
 * Uses sql.js-backed test databases for both local and remote stores.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	DeviceDatabaseInfo,
	DeviceDiscoveryService,
} from "../../../src/integration/device/device-discovery.service";
import { DeviceSyncService } from "../../../src/integration/device/device-sync.service";
import type { IPersistence } from "../../../src/interfaces/persistence";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "../../persistence/sqlite/__setup__/test-database";

// ── Mock loader so SqliteDatabase.init() works with sql.js ──────────

vi.mock("@true-recall/core/persistence/sqlite/loader", async () => {
	const sqlJs = await import("sql.js");
	const SQL = await sqlJs.default();

	interface QueryExecResult {
		columns: string[];
		values: (string | number | null | Uint8Array)[][];
	}

	type BindParams = (string | number | null | Uint8Array)[];

	class TestWrapper {
		constructor(private sqlDb: InstanceType<typeof SQL.Database>) {}

		exec(sql: string, params?: BindParams): QueryExecResult[] {
			if (!params || params.length === 0) {
				return this.sqlDb.exec(sql) as QueryExecResult[];
			}
			const stmt = this.sqlDb.prepare(sql);
			stmt.bind(params);
			const results: QueryExecResult[] = [];
			const columns: string[] = stmt.getColumnNames();
			const values: (string | number | null | Uint8Array)[][] = [];
			while (stmt.step()) {
				values.push(stmt.get() as (string | number | null | Uint8Array)[]);
			}
			if (columns.length > 0) {
				results.push({ columns, values });
			}
			stmt.free();
			return results;
		}

		run(sql: string, params?: BindParams): void {
			this.sqlDb.run(sql, params);
		}

		export(): Uint8Array {
			return this.sqlDb.export();
		}

		close(): void {
			this.sqlDb.close();
		}

		getRowsModified(): number {
			return this.sqlDb.getRowsModified();
		}
	}

	return {
		loadDatabase: async (existingData?: Uint8Array | null) => {
			const db = existingData
				? new SQL.Database(existingData)
				: new SQL.Database();
			return { db: new TestWrapper(db) };
		},
		resetLoaderState: () => {},
	};
});

// ── Mock persistence (in-memory Map) ────────────────────────────────

class MockPersistence implements IPersistence {
	private files = new Map<string, Uint8Array>();

	async readBinary(path: string): Promise<Uint8Array | null> {
		return this.files.get(path) ?? null;
	}

	async read(path: string): Promise<string> {
		const data = this.files.get(path);
		if (!data) throw new Error(`File not found: ${path}`);
		return new TextDecoder().decode(data);
	}

	async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
		this.files.set(path, new Uint8Array(data));
	}

	async exists(path: string): Promise<boolean> {
		return this.files.has(path);
	}

	async mkdir(_path: string): Promise<void> {}

	async list(_path: string): Promise<{ files: string[]; folders: string[] }> {
		return { files: [], folders: [] };
	}

	async remove(path: string): Promise<void> {
		this.files.delete(path);
	}

	async stat(_path: string): Promise<{ size: number; mtime: number } | null> {
		return null;
	}

	/** Store binary data for a given path (test helper) */
	seedBinary(path: string, data: Uint8Array): void {
		this.files.set(path, data);
	}
}

// ── Helpers ─────────────────────────────────────────────────────────

function makeDeviceInfo(
	overrides: Partial<DeviceDatabaseInfo> & {
		deviceId: string;
		path: string;
	},
): DeviceDatabaseInfo {
	return {
		filename: overrides.path.split("/").pop() ?? "",
		lastModified: new Date(),
		sizeBytes: 1024,
		formattedSize: "1.0 KB",
		cardCount: null,
		lastReviewDate: null,
		isCurrentDevice: false,
		...overrides,
	};
}

/** Build a mock SqliteStoreService backed by a TestContext */
function buildLocalStore(ctx: TestContext) {
	return {
		cards: ctx.cards,
		stats: ctx.stats,
		notes: ctx.notes,
		noteTypes: ctx.noteTypes,
	};
}

/**
 * Create a remote database binary by populating a TestSqliteDatabase,
 * inserting test data via callbacks, and exporting the raw bytes.
 */
async function createRemoteDbBinary(
	populate: (ctx: TestContext) => void,
): Promise<Uint8Array> {
	const remoteCtx = await createTestContext();
	try {
		populate(remoteCtx);
		return remoteCtx.db.raw.export();
	} finally {
		remoteCtx.close();
	}
}

// ── Tests ───────────────────────────────────────────────────────────

describe("DeviceSyncService", () => {
	let localCtx: TestContext;
	let persistence: MockPersistence;
	let discoveryMock: DeviceDiscoveryService;
	let service: DeviceSyncService;

	beforeEach(async () => {
		localCtx = await createTestContext();
		persistence = new MockPersistence();

		discoveryMock = {
			discoverDeviceDatabases: vi.fn(async () => []),
		} as unknown as DeviceDiscoveryService;

		const localStore = buildLocalStore(localCtx);
		service = new DeviceSyncService(
			localStore as never,
			discoveryMock,
			persistence,
		);
	});

	afterEach(() => {
		localCtx.close();
	});

	it("syncOnStartup returns zero results when no remote devices found", async () => {
		// Arrange
		vi.mocked(discoveryMock.discoverDeviceDatabases).mockResolvedValue([]);

		// Act
		const result = await service.syncOnStartup();

		// Assert
		expect(result.devicesFound).toBe(0);
		expect(result.cardsApplied).toBe(0);
		expect(result.reviewLogsApplied).toBe(0);
		expect(result.errors).toHaveLength(0);
	});

	it("syncOnStartup merges cards from remote device", async () => {
		// Arrange
		const remotePath = ".true-recall/true-recall-remote01.db";
		const remoteCard = createTestCard({
			id: "remote-card-1",
			question: "Remote Q",
			answer: "Remote A",
		});

		const remoteBinary = await createRemoteDbBinary((ctx) => {
			ctx.cards.set(remoteCard.id, remoteCard);
		});
		persistence.seedBinary(remotePath, remoteBinary);

		vi.mocked(discoveryMock.discoverDeviceDatabases).mockResolvedValue([
			makeDeviceInfo({
				deviceId: "remote01",
				path: remotePath,
				isCurrentDevice: false,
			}),
		]);

		// Act
		const result = await service.syncOnStartup();

		// Assert
		expect(result.devicesFound).toBe(1);
		expect(result.cardsApplied).toBe(1);
		expect(result.errors).toHaveLength(0);

		// upsertFromRemote preserves the remote noteId but does not copy the
		// note row, so the JOIN-based get() returns undefined.
		// Verify the card row exists directly.
		expect(localCtx.cards.has("remote-card-1")).toBe(true);

		const raw = localCtx.db.get<{ id: string; stability: number }>(
			"SELECT id, stability FROM cards WHERE id = ?",
			["remote-card-1"],
		);
		expect(raw).toBeDefined();
		expect(raw?.id).toBe("remote-card-1");
	});

	it("syncOnStartup handles empty remote DB gracefully", async () => {
		// Arrange — path exists but binary is empty
		const remotePath = ".true-recall/true-recall-empty001.db";
		persistence.seedBinary(remotePath, new Uint8Array(0));

		vi.mocked(discoveryMock.discoverDeviceDatabases).mockResolvedValue([
			makeDeviceInfo({
				deviceId: "empty001",
				path: remotePath,
				isCurrentDevice: false,
			}),
		]);

		// Act
		const result = await service.syncOnStartup();

		// Assert
		expect(result.devicesFound).toBe(1);
		expect(result.cardsApplied).toBe(0);
		expect(result.reviewLogsApplied).toBe(0);
		expect(result.errors).toHaveLength(0);
	});

	it("syncOnStartup skips current device databases", async () => {
		// Arrange — discovery returns only the current device
		vi.mocked(discoveryMock.discoverDeviceDatabases).mockResolvedValue([
			makeDeviceInfo({
				deviceId: "local001",
				path: ".true-recall/true-recall-local001.db",
				isCurrentDevice: true,
			}),
		]);

		// Act
		const result = await service.syncOnStartup();

		// Assert — current device is filtered out
		expect(result.devicesFound).toBe(0);
		expect(result.cardsApplied).toBe(0);
		expect(result.errors).toHaveLength(0);
	});

	it("syncOnStartup collects errors without stopping", async () => {
		// Arrange — one invalid path (non-SQLite binary), one valid remote
		const invalidPath = ".true-recall/true-recall-invalid1.db";
		const validPath = ".true-recall/true-recall-valid001.db";

		// Non-empty but not a valid SQLite database
		persistence.seedBinary(invalidPath, new Uint8Array([0xff, 0xfe]));

		const validBinary = await createRemoteDbBinary((ctx) => {
			ctx.cards.set(
				"valid-card",
				createTestCard({ id: "valid-card", question: "Valid Q" }),
			);
		});
		persistence.seedBinary(validPath, validBinary);

		vi.mocked(discoveryMock.discoverDeviceDatabases).mockResolvedValue([
			makeDeviceInfo({
				deviceId: "invalid1",
				path: invalidPath,
				isCurrentDevice: false,
			}),
			makeDeviceInfo({
				deviceId: "valid001",
				path: validPath,
				isCurrentDevice: false,
			}),
		]);

		// Act
		const result = await service.syncOnStartup();

		// Assert — error collected for invalid, valid still processed
		expect(result.devicesFound).toBe(2);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		expect(result.errors[0]).toContain("invalid1");

		expect(localCtx.cards.has("valid-card")).toBe(true);
	});

	it("syncOnStartup reports discovery failure as error", async () => {
		// Arrange
		vi.mocked(discoveryMock.discoverDeviceDatabases).mockRejectedValue(
			new Error("Network unreachable"),
		);

		// Act
		const result = await service.syncOnStartup();

		// Assert
		expect(result.devicesFound).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("Network unreachable");
	});
});
