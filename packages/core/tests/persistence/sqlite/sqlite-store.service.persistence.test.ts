import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IPersistence } from "../../../src/interfaces/persistence";
import { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import { SAVE_DEBOUNCE_MS } from "../../../src/persistence/sqlite/sqlite.types";

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
		saveDebounceMs?: number;
	}) {
		// Track written byte sizes so the atomic write's post-write size
		// verification and tmp→main rename see a consistent filesystem.
		const written = new Map<string, number>();
		const persistence: IPersistence = {
			exists: vi.fn(async (path: string) => written.has(path)),
			mkdir: vi.fn(async () => {}),
			writeBinary: vi.fn(async (path: string, data: ArrayBuffer) => {
				if (opts?.writeBinary) await opts.writeBinary(path, data);
				else opts?.onWrite?.();
				written.set(path, data.byteLength);
			}),
			rename: vi.fn(async (oldPath: string, newPath: string) => {
				const size = written.get(oldPath);
				if (size === undefined)
					throw new Error(`Cannot rename missing file: ${oldPath}`);
				written.set(newPath, size);
				written.delete(oldPath);
			}),
			readBinary: vi.fn(async () => null),
			read: vi.fn(async () => ""),
			list: vi.fn(async () => ({ files: [], folders: [] })),
			remove: vi.fn(async (path: string) => {
				written.delete(path);
			}),
			stat: vi.fn(async (path: string) => {
				const size = written.get(path);
				return size === undefined ? null : { size, mtime: 0 };
			}),
		};

		const store = new SqliteStoreService(
			persistence,
			"dev12345",
			opts?.saveDebounceMs !== undefined
				? { saveDebounceMs: opts.saveDebounceMs }
				: {},
		);
		(store as unknown as { db: unknown }).db = {
			isReady: () => true,
			export: () => opts?.exportData ?? new Uint8Array([1, 2, 3, 4]),
			close: () => {},
		};

		return { store, persistence };
	}

	it("uses 5s debounce window instead of 60s", async () => {
		const { store, persistence } = createStoreWithMocks();

		(store as unknown as { markDirty: () => void }).markDirty();

		await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1);
		expect(persistence.writeBinary).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(persistence.writeBinary).toHaveBeenCalledTimes(1);
	});

	it("honors a custom saveDebounceMs (mobile tuning)", async () => {
		const { store, persistence } = createStoreWithMocks({
			saveDebounceMs: 400,
		});

		(store as unknown as { markDirty: () => void }).markDirty();

		await vi.advanceTimersByTimeAsync(399);
		expect(persistence.writeBinary).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(persistence.writeBinary).toHaveBeenCalledTimes(1);
	});

	it("preserves writes that happen during an in-flight flush", async () => {
		let writeCount = 0;
		const { store, persistence } = createStoreWithMocks({
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
		expect(persistence.writeBinary).toHaveBeenCalledTimes(1);

		// Follow-up flush should run quickly (250ms), not after full debounce.
		await vi.advanceTimersByTimeAsync(250);
		expect(persistence.writeBinary).toHaveBeenCalledTimes(2);
	});

	it("writes exact byte range from Uint8Array views", async () => {
		const oversized = new Uint8Array([9, 9, 9, 1, 2, 3, 4]);
		const view = oversized.subarray(3); // [1,2,3,4] over bigger buffer
		const { store, persistence } = createStoreWithMocks({ exportData: view });

		(store as unknown as { isDirty: boolean }).isDirty = true;
		await (store as unknown as { doFlush: () => Promise<boolean> }).doFlush();

		expect(persistence.writeBinary).toHaveBeenCalledTimes(1);
		const arg = (persistence.writeBinary as ReturnType<typeof vi.fn>).mock
			.calls[0]?.[1] as ArrayBuffer;
		expect(Array.from(new Uint8Array(arg))).toEqual([1, 2, 3, 4]);
	});

	it("saveNow waits for an in-flight flush and then drains remaining dirty state", async () => {
		let releaseWrite: (() => void) | null = null;
		const writeGate = new Promise<void>((resolve) => {
			releaseWrite = resolve;
		});
		const { store, persistence } = createStoreWithMocks({
			writeBinary: async () => {
				await writeGate;
			},
		});

		(store as unknown as { isDirty: boolean }).isDirty = true;
		const inFlight = (
			store as unknown as { doFlush: () => Promise<boolean> }
		).doFlush();

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
		expect(persistence.writeBinary).toHaveBeenCalledTimes(1);
		expect((store as unknown as { isDirty: boolean }).isDirty).toBe(false);
	});
});
