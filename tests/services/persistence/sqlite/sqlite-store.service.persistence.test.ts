import { SqliteStoreService } from "../../../../src/features/core/persistence/sqlite/SqliteStoreService";
import { SAVE_DEBOUNCE_MS } from "../../../../src/features/core/persistence/sqlite/sqlite.types";
import type { App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("SqliteStoreService persistence durability", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function createStoreWithMocks(opts?: {
		exportData?: Uint8Array;
		onWrite?: () => void;
		writeBinary?: (_path: string, _data: ArrayBuffer) => Promise<void>;
	}) {
		const adapter = {
			exists: vi.fn(async () => true),
			mkdir: vi.fn(async () => {}),
			writeBinary: vi.fn(
				async (path: string, data: ArrayBuffer) =>
					opts?.writeBinary?.(path, data) ?? opts?.onWrite?.(),
			),
		};

		const app = {
			vault: { adapter },
		} as unknown as App;

		const store = new SqliteStoreService(app, "dev12345");
		(store as unknown as { db: unknown }).db = {
			isReady: () => true,
			export: () => opts?.exportData ?? new Uint8Array([1, 2, 3, 4]),
			close: () => {},
		};

		return { store, adapter };
	}

	it("uses 5s debounce window instead of 60s", async () => {
		const { store, adapter } = createStoreWithMocks();

		(store as unknown as { markDirty: () => void }).markDirty();

		await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1);
		expect(adapter.writeBinary).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(adapter.writeBinary).toHaveBeenCalledTimes(1);
	});

	it("preserves writes that happen during an in-flight flush", async () => {
		let writeCount = 0;
		const { store, adapter } = createStoreWithMocks({
			onWrite: () => {
				writeCount++;
				if (writeCount === 1) {
					// Simulate mutation while first write is in progress.
					(store as unknown as { isDirty: boolean }).isDirty = true;
				}
			},
		});

		(store as unknown as { isDirty: boolean }).isDirty = true;

		await (store as unknown as { doFlush: () => Promise<boolean> }).doFlush();
		expect(adapter.writeBinary).toHaveBeenCalledTimes(1);

		// Follow-up flush should run quickly (250ms), not after full debounce.
		await vi.advanceTimersByTimeAsync(250);
		expect(adapter.writeBinary).toHaveBeenCalledTimes(2);
	});

	it("writes exact byte range from Uint8Array views", async () => {
		const oversized = new Uint8Array([9, 9, 9, 1, 2, 3, 4]);
		const view = oversized.subarray(3); // [1,2,3,4] over bigger buffer
		const { store, adapter } = createStoreWithMocks({ exportData: view });

		(store as unknown as { isDirty: boolean }).isDirty = true;
		await (store as unknown as { doFlush: () => Promise<boolean> }).doFlush();

		expect(adapter.writeBinary).toHaveBeenCalledTimes(1);
		const arg = adapter.writeBinary.mock.calls[0]?.[1] as ArrayBuffer;
		expect(Array.from(new Uint8Array(arg))).toEqual([1, 2, 3, 4]);
	});

	it("saveNow waits for an in-flight flush and then drains remaining dirty state", async () => {
		let releaseWrite: (() => void) | null = null;
		const writeGate = new Promise<void>((resolve) => {
			releaseWrite = resolve;
		});
		const { store, adapter } = createStoreWithMocks({
			writeBinary: async () => {
				await writeGate;
			},
		});

		(store as unknown as { isDirty: boolean }).isDirty = true;
		const inFlight = (store as unknown as { doFlush: () => Promise<boolean> }).doFlush();

		let settled = false;
		const saveNowPromise = store.saveNow().then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		releaseWrite?.();
		await inFlight;
		await saveNowPromise;

		expect(settled).toBe(true);
		expect(adapter.writeBinary).toHaveBeenCalledTimes(1);
		expect((store as unknown as { isDirty: boolean }).isDirty).toBe(false);
	});
});
