import { describe, expect, it, vi } from "vitest";

import { CloudSyncService } from "../../../src/integration/cloud/cloud-sync.service";
import type { CloudSyncTransport } from "../../../src/integration/cloud/cloud-sync.types";
import type { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";

function createStore() {
	const meta = new Map<string, string>();
	let transactionDepth = 0;
	const cards = [
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
			upsertFromRemote: () => false,
			getActiveDedupRows: () => [],
		},
		stats: {
			getModifiedReviewLogSince: () => [],
			getReviewedCardIdsSince: () => [],
			upsertReviewLogFromRemote: () => false,
			rebuildDailyStatsFromReviewLog: vi.fn(),
		},
		meta,
	} as unknown as SqliteStoreService & { meta: Map<string, string> };
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
});
