import { describe, expect, it, vi } from "vitest";

import { CloudSyncService } from "../../../src/integration/cloud/cloud-sync.service";
import type { CloudSyncTransport } from "../../../src/integration/cloud/cloud-sync.types";
import type { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import type { FsrsReplayService } from "../../../src/services/fsrs/fsrs-replay.service";

type MockCardRow = Record<string, unknown> & { id: string; updatedAt: number };

function createStore(initialCards?: MockCardRow[]) {
	const meta = new Map<string, string>();
	let transactionDepth = 0;
	const cards: MockCardRow[] = initialCards ?? [
		{
			id: "card-1",
			updatedAt: 100,
			deletedAt: null,
			due: "2026-09-01T00:00:00.000Z",
			stability: 1,
			difficulty: 5,
			reps: 0,
			lapses: 0,
			state: 0,
			scheduledDays: 0,
		},
	];
	return {
		transaction: <T>(run: () => T) => {
			if (transactionDepth > 0) throw new Error("nested transaction");
			transactionDepth++;
			try {
				return run();
			} finally {
				transactionDepth--;
			}
		},
		noteTypes: {
			getRawRowsModifiedSince: () => [],
			upsertRowFromRemote: () => false,
		},
		notes: {
			getRawRowsModifiedSince: () => [],
			upsertRowFromRemote: () => false,
		},
		cards: {
			getModifiedSince: (since: number) =>
				cards.filter((card) => card.updatedAt > since),
			getSyncMetadata: (key: string) => meta.get(key) ?? null,
			setSyncMetadata: (key: string, value: string) => meta.set(key, value),
			setSyncMetadataIfChanged: (key: string, value: string) => {
				if (meta.get(key) === value) return false;
				meta.set(key, value);
				return true;
			},
			upsertFromRemote: vi.fn(() => false),
			getActiveDedupRows: vi.fn(() => []),
			applyReplayedScheduling: vi.fn(),
		},
		stats: {
			getModifiedReviewLogSince: () => [],
			getReviewedCardIdsSince: () => [] as string[],
			upsertReviewLogFromRemote: vi.fn(() => false),
			rebuildDailyStatsFromReviewLog: vi.fn(),
			getReplayLogsForCard: vi.fn(() => []),
		},
		meta,
		mockCards: cards,
	} as unknown as SqliteStoreService & {
		meta: Map<string, string>;
		mockCards: MockCardRow[];
	};
}

describe("CloudSyncService", () => {
	it("pushes local changes and advances both durable watermarks", async () => {
		const store = createStore();
		const exchange = vi.fn(async (request) => ({
			changes: request.changes,
			cursor: 7,
			hasMore: false,
		}));
		const transport: CloudSyncTransport = { exchange };

		const result = await new CloudSyncService(store, transport, {
			accountId: "account-1",
			deviceId: "device-a",
		}).sync();

		expect(result.errors).toEqual([]);
		expect(result.pushed).toBe(1);
		expect(exchange).toHaveBeenCalledOnce();
		expect(store.meta.get("cloud:account-1:push")).toBe("100");
		expect(store.meta.get("cloud:account-1:cursor")).toBe("7");
	});

	it("does not advance watermarks after a transport failure", async () => {
		const store = createStore();
		const transport: CloudSyncTransport = {
			exchange: vi.fn(async () => {
				throw new Error("offline");
			}),
		};

		const result = await new CloudSyncService(store, transport, {
			accountId: "account-1",
			deviceId: "device-a",
		}).sync();

		expect(result.errors).toEqual(["offline"]);
		expect(store.meta.size).toBe(0);
	});

	it("uses the server device tie-breaker for equal timestamps", async () => {
		const store = createStore();
		const upsert = vi.fn(() => true);
		store.cards.upsertFromRemote = upsert;
		const transport: CloudSyncTransport = {
			exchange: vi.fn(async (request) => ({
				changes: request.changes.map((change) => ({
					...change,
					sourceDeviceId: "device-b",
				})),
				cursor: 8,
				hasMore: false,
			})),
		};

		await new CloudSyncService(store, transport, {
			accountId: "account-1",
			deviceId: "device-a",
		}).sync();

		expect(upsert).toHaveBeenCalledWith(expect.any(Object), true);
	});

	it("keeps the local version when a pending equal-timestamp edit wins the tie-break", async () => {
		const store = createStore();
		const upsert = vi.fn(() => true);
		store.cards.upsertFromRemote = upsert;
		const transport: CloudSyncTransport = {
			exchange: vi.fn(async (request) => ({
				changes: request.changes.map((change) => ({
					...change,
					sourceDeviceId: "device-0",
				})),
				cursor: 8,
				hasMore: false,
			})),
		};

		await new CloudSyncService(store, transport, {
			accountId: "account-1",
			deviceId: "device-a",
		}).sync();

		expect(upsert).toHaveBeenCalledWith(expect.any(Object), false);
	});

	it("prefers the server winner for equal timestamps pulled in a later sync", async () => {
		const store = createStore();
		// The local edit was already pushed in an earlier sync.
		store.meta.set("cloud:account-1:push", "100");
		const upsert = vi.fn(() => true);
		store.cards.upsertFromRemote = upsert;
		const transport: CloudSyncTransport = {
			exchange: vi.fn(async () => ({
				changes: [
					{
						entityType: "card" as const,
						entityId: "card-1",
						updatedAt: 100,
						sourceDeviceId: "device-b",
						payload: { id: "card-1", updatedAt: 100 },
					},
				],
				cursor: 9,
				hasMore: false,
			})),
		};

		await new CloudSyncService(store, transport, {
			accountId: "account-1",
			deviceId: "device-a",
		}).sync();

		expect(upsert).toHaveBeenCalledWith(expect.any(Object), true);
	});

	it("does not re-push rows applied from the cloud and keeps the push watermark local", async () => {
		const store = createStore();
		store.cards.upsertFromRemote = vi.fn(
			(data: MockCardRow & { updatedAt?: number }) => {
				store.mockCards.push({ ...data, updatedAt: data.updatedAt ?? 0 });
				return true;
			},
		) as typeof store.cards.upsertFromRemote;
		// The remote row carries a timestamp from a device with a fast clock.
		const remoteChange = {
			entityType: "card" as const,
			entityId: "card-2",
			updatedAt: 9999,
			sourceDeviceId: "device-z",
			payload: { id: "card-2", updatedAt: 9999 },
		};
		let call = 0;
		const exchange = vi.fn(async () => {
			call++;
			return {
				changes: call === 1 ? [remoteChange] : [],
				cursor: 3,
				hasMore: false,
			};
		});
		const service = new CloudSyncService(
			store,
			{ exchange },
			{ accountId: "account-1", deviceId: "device-a" },
		);

		const first = await service.sync();
		const second = await service.sync();

		expect(first.errors).toEqual([]);
		expect(second.errors).toEqual([]);
		expect(second.pushed).toBe(0);
		expect(exchange).toHaveBeenLastCalledWith({ cursor: 3, changes: [] });
		expect(store.meta.get("cloud:account-1:push")).toBe("100");
	});

	it("splits push batches so each request stays under the transport size limit", async () => {
		const bigField = "x".repeat(2_500_000);
		const store = createStore([
			{ id: "c1", updatedAt: 1, big: bigField },
			{ id: "c2", updatedAt: 2, big: bigField },
			{ id: "c3", updatedAt: 3 },
		]);
		const exchange = vi.fn(async () => ({
			changes: [],
			cursor: 1,
			hasMore: false,
		}));

		const result = await new CloudSyncService(
			store,
			{ exchange },
			{ accountId: "account-1", deviceId: "device-a" },
		).sync();

		expect(result.errors).toEqual([]);
		expect(result.pushed).toBe(3);
		expect(exchange).toHaveBeenCalledTimes(2);
		expect(exchange.mock.calls[0]?.[0].changes.map((c) => c.entityId)).toEqual([
			"c1",
		]);
		expect(exchange.mock.calls[1]?.[0].changes.map((c) => c.entityId)).toEqual([
			"c2",
			"c3",
		]);
	});

	it("recovers daily stats and FSRS replay after a pull that failed mid-sync", async () => {
		const store = createStore();
		store.stats.getReviewedCardIdsSince = vi.fn(() => ["card-9"]);
		store.stats.upsertReviewLogFromRemote = vi.fn(() => true);
		const replayCard = vi.fn(() => null);
		const replayService = {
			replayCard,
		} as unknown as FsrsReplayService;
		const remoteLog = {
			entityType: "review_log" as const,
			entityId: "log-1",
			updatedAt: 50,
			sourceDeviceId: "device-b",
			payload: {
				id: "log-1",
				cardId: "card-9",
				reviewKind: "review",
				deletedAt: null,
				updatedAt: 50,
			},
		};
		let call = 0;
		const exchange = vi.fn(async () => {
			call++;
			if (call === 1) return { changes: [remoteLog], cursor: 5, hasMore: true };
			if (call === 2) throw new Error("offline");
			return { changes: [], cursor: 5, hasMore: false };
		});
		const service = new CloudSyncService(
			store,
			{ exchange },
			{ accountId: "account-1", deviceId: "device-a", replayService },
		);

		const first = await service.sync();
		expect(first.errors).toEqual(["offline"]);
		expect(store.stats.rebuildDailyStatsFromReviewLog).not.toHaveBeenCalled();

		const second = await service.sync();
		expect(second.errors).toEqual([]);
		expect(replayCard).toHaveBeenCalledWith("card-9", []);
		expect(store.stats.rebuildDailyStatsFromReviewLog).toHaveBeenCalledOnce();
		expect(store.meta.get("cloud:account-1:pending") ?? "").toBe("");
	});

	it("skips the duplicate scan when nothing was pulled", async () => {
		const store = createStore();
		const exchange = vi.fn(async () => ({
			changes: [],
			cursor: 0,
			hasMore: false,
		}));

		await new CloudSyncService(
			store,
			{ exchange },
			{ accountId: "account-1", deviceId: "device-a" },
		).sync();

		expect(store.cards.getActiveDedupRows).not.toHaveBeenCalled();
		expect(store.stats.rebuildDailyStatsFromReviewLog).not.toHaveBeenCalled();
	});
});
