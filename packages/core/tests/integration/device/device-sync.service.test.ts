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
import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import {
	FsrsReplayService,
	type ReplayLogEntry,
} from "../../../src/services/fsrs/fsrs-replay.service";
import type { FSRSSettings } from "../../../src/types/settings.types";
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
		transaction: <T>(fn: () => T): T => ctx.db.transaction(fn),
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

		// The note row is merged along with the card, so the JOIN-based
		// get() must return a fully hydrated card (an FK-enforced production
		// DB would otherwise reject the card entirely).
		expect(localCtx.cards.has("remote-card-1")).toBe(true);

		const synced = localCtx.cards.get("remote-card-1");
		expect(synced).toBeDefined();
		expect(synced?.question).toBe("Remote Q");
		expect(synced?.answer).toBe("Remote A");
	});

	it("advances the sync watermark to the max remote updated_at, not the local clock", async () => {
		const remotePath = ".true-recall/true-recall-remote01.db";
		const remoteUpdatedAt = Date.now() - 60_000;
		const remoteCard = createTestCard({ id: "remote-card-wm" });

		const remoteBinary = await createRemoteDbBinary((ctx) => {
			ctx.cards.set(remoteCard.id, remoteCard);
			ctx.db.run(`UPDATE cards SET updated_at = ?`, [remoteUpdatedAt]);
			ctx.db.run(`UPDATE notes SET updated_at = ?`, [remoteUpdatedAt]);
		});
		persistence.seedBinary(remotePath, remoteBinary);

		vi.mocked(discoveryMock.discoverDeviceDatabases).mockResolvedValue([
			makeDeviceInfo({
				deviceId: "remote01",
				path: remotePath,
				isCurrentDevice: false,
			}),
		]);

		await service.syncOnStartup();

		// A Date.now() watermark would skip rows delivered late by file sync.
		const watermark = Number(localCtx.cards.getSyncMetadata("sync:remote01"));
		expect(watermark).toBe(remoteUpdatedAt);
	});

	it("backfills a note older than the watermark for a newly modified card", async () => {
		// Arrange — the remote note predates the watermark (so it is absent from
		// modifiedNotes), only the card row is fresh, and the note is unknown
		// locally. The FK backfill must fetch it anyway.
		const remotePath = ".true-recall/true-recall-remote01.db";
		const oldTs = Date.now() - 100_000;
		const newTs = Date.now() - 1_000;
		const remoteCard = createTestCard({
			id: "backfill-card",
			question: "Backfill Q",
			answer: "Backfill A",
		});

		const remoteBinary = await createRemoteDbBinary((ctx) => {
			ctx.cards.set(remoteCard.id, remoteCard);
			ctx.db.run(`UPDATE notes SET updated_at = ?`, [oldTs]);
			ctx.db.run(`UPDATE cards SET updated_at = ?`, [newTs]);
		});
		persistence.seedBinary(remotePath, remoteBinary);
		localCtx.cards.setSyncMetadata("sync:remote01", String(oldTs + 1));

		vi.mocked(discoveryMock.discoverDeviceDatabases).mockResolvedValue([
			makeDeviceInfo({
				deviceId: "remote01",
				path: remotePath,
				isCurrentDevice: false,
			}),
		]);

		// Act
		const result = await service.syncOnStartup();

		// Assert — card is hydrated through the JOIN with the backfilled note
		expect(result.cardsApplied).toBe(1);
		const synced = localCtx.cards.get("backfill-card");
		expect(synced?.question).toBe("Backfill Q");
		expect(synced?.answer).toBe("Backfill A");
	});

	it("refuses to merge from a device with a newer schema version", async () => {
		// Arrange — remote claims a schema this plugin version does not know
		const remotePath = ".true-recall/true-recall-newer001.db";
		const remoteBinary = await createRemoteDbBinary((ctx) => {
			ctx.cards.set("future-card", createTestCard({ id: "future-card" }));
			ctx.db.run(
				`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '999')`,
			);
		});
		persistence.seedBinary(remotePath, remoteBinary);

		vi.mocked(discoveryMock.discoverDeviceDatabases).mockResolvedValue([
			makeDeviceInfo({
				deviceId: "newer001",
				path: remotePath,
				isCurrentDevice: false,
			}),
		]);

		// Act
		const result = await service.syncOnStartup();

		// Assert — nothing applied, error names the version mismatch
		expect(result.cardsApplied).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("schema");
		expect(localCtx.cards.has("future-card")).toBe(false);
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

	it("merges concurrent reviews of the same card by replaying FSRS from the union", async () => {
		// Arrange — the same card was reviewed offline on both devices.
		const settings: FSRSSettings = {
			requestRetention: 0.9,
			maximumInterval: 36500,
			weights: null,
			enableFuzz: true,
			learningSteps: [1, 10],
			relearningSteps: [10],
			enableShortTerm: true,
		};
		const replayService = new FsrsReplayService(
			new FSRSService(settings),
			() => settings,
		);
		const localStore = buildLocalStore(localCtx);
		const replayingSyncService = new DeviceSyncService(
			localStore as never,
			discoveryMock,
			persistence,
			{ replayService },
		);

		const insertLog = (
			ctx: TestContext,
			id: string,
			deviceId: string,
			reviewedAt: string,
			rating: number,
		) => {
			ctx.db.run(
				`INSERT INTO review_log (
					id, card_id, reviewed_at, rating, scheduled_days, elapsed_days,
					state, time_spent_ms, updated_at, deleted_at, preset_name,
					device_id, review_kind
				) VALUES (?, 'conflict-card', ?, ?, 1, 0, 0, 1000, ?, NULL, NULL, ?, 'review')`,
				[id, reviewedAt, rating, new Date(reviewedAt).getTime(), deviceId],
			);
		};

		const card = createTestCard({ id: "conflict-card" });
		localCtx.cards.set(card.id, card);
		insertLog(localCtx, "log-local", "local001", "2026-08-10T10:00:00.000Z", 3);

		const remotePath = ".true-recall/true-recall-remote01.db";
		const remoteBinary = await createRemoteDbBinary((ctx) => {
			ctx.cards.set(card.id, createTestCard({ id: "conflict-card" }));
			insertLog(ctx, "log-remote", "remote01", "2026-08-11T10:00:00.000Z", 1);
			// Remote card row wins plain row-LWW; replay must still see both logs.
			ctx.db.run(`UPDATE cards SET updated_at = ?`, [Date.now() + 60_000]);
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
		const result = await replayingSyncService.syncOnStartup();

		// Assert — both reviews survive and the card state is the deterministic
		// replay of their union, not either device's provisional state.
		expect(result.errors).toHaveLength(0);
		expect(result.conflictsReplayed).toBe(1);

		const logs = localCtx.db.query<{ id: string }>(
			`SELECT id FROM review_log WHERE card_id = 'conflict-card' ORDER BY id`,
		);
		expect(logs.map((l) => l.id)).toEqual(["log-local", "log-remote"]);

		const reference: ReplayLogEntry[] = [
			{
				id: "log-local",
				reviewedAt: "2026-08-10T10:00:00.000Z",
				rating: 3,
				presetName: null,
				deviceId: "local001",
				reviewKind: "review",
				deletedAt: null,
			},
			{
				id: "log-remote",
				reviewedAt: "2026-08-11T10:00:00.000Z",
				rating: 1,
				presetName: null,
				deviceId: "remote01",
				reviewKind: "review",
				deletedAt: null,
			},
		];
		const expected = replayService.replayCard("conflict-card", reference);
		const merged = localCtx.cards.get("conflict-card");
		expect(merged?.due).toBe(expected?.due);
		expect(merged?.stability).toBe(expected?.stability);
		expect(merged?.reps).toBe(expected?.reps);
		expect(merged?.state).toBe(expected?.state);
	});

	it("does not replay when only the remote device reviewed the card", async () => {
		// Arrange — no local reviews since the watermark; plain LWW is correct
		// and must remain untouched (manual due tweaks survive).
		const settings: FSRSSettings = {
			requestRetention: 0.9,
			maximumInterval: 36500,
			weights: null,
			enableFuzz: true,
			learningSteps: [1, 10],
			relearningSteps: [10],
			enableShortTerm: true,
		};
		const replayService = new FsrsReplayService(
			new FSRSService(settings),
			() => settings,
		);
		const localStore = buildLocalStore(localCtx);
		const replayingSyncService = new DeviceSyncService(
			localStore as never,
			discoveryMock,
			persistence,
			{ replayService },
		);

		const remotePath = ".true-recall/true-recall-remote01.db";
		const remoteBinary = await createRemoteDbBinary((ctx) => {
			ctx.cards.set("solo-card", createTestCard({ id: "solo-card" }));
			ctx.db.run(
				`INSERT INTO review_log (
					id, card_id, reviewed_at, rating, scheduled_days, elapsed_days,
					state, time_spent_ms, updated_at, deleted_at, preset_name,
					device_id, review_kind
				) VALUES ('log-solo', 'solo-card', '2026-08-11T10:00:00.000Z', 3, 1, 0, 0, 1000, ?, NULL, NULL, 'remote01', 'review')`,
				[Date.now()],
			);
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
		const result = await replayingSyncService.syncOnStartup();

		// Assert
		expect(result.conflictsReplayed).toBe(0);
		expect(result.reviewLogsApplied).toBe(1);
	});

	it("converges duplicate cards created concurrently from the same note block", async () => {
		// Arrange — both devices collected the same block before syncing, so two
		// card ids exist for one logical card (same source_uid + ord + fields).
		const localDup = createTestCard({
			id: "dup-local",
			question: "Dup Q",
			answer: "Dup A",
			sourceUid: "abcd1234",
		});
		localCtx.cards.set(localDup.id, localDup);
		localCtx.db.run(
			`UPDATE cards SET created_at = ? WHERE id = 'dup-local'`,
			[1_000_000],
		);

		const remotePath = ".true-recall/true-recall-remote01.db";
		const remoteBinary = await createRemoteDbBinary((ctx) => {
			const remoteDup = createTestCard({
				id: "dup-remote",
				question: "Dup Q",
				answer: "Dup A",
				sourceUid: "abcd1234",
			});
			ctx.cards.set(remoteDup.id, remoteDup);
			ctx.db.run(
				`UPDATE cards SET created_at = ? WHERE id = 'dup-remote'`,
				[2_000_000],
			);
			ctx.db.run(
				`INSERT INTO review_log (
					id, card_id, reviewed_at, rating, scheduled_days, elapsed_days,
					state, time_spent_ms, updated_at, deleted_at, preset_name,
					device_id, review_kind
				) VALUES ('log-dup', 'dup-remote', '2026-08-11T10:00:00.000Z', 3, 1, 0, 0, 1000, ?, NULL, NULL, 'remote01', 'review')`,
				[Date.now()],
			);
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

		// Assert — the earlier-created card survives, the newcomer is tombstoned,
		// and its review history is reattached to the survivor.
		expect(result.duplicatesMerged).toBe(1);
		expect(localCtx.cards.has("dup-local")).toBe(true);
		expect(localCtx.cards.has("dup-remote")).toBe(false);

		const logOwner = localCtx.db.get<{ card_id: string }>(
			`SELECT card_id FROM review_log WHERE id = 'log-dup'`,
		);
		expect(logOwner?.card_id).toBe("dup-local");
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
