import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type DeviceLock,
	DeviceLockService,
} from "../../../src/integration/device/device-lock.service";
import type { IPersistence } from "../../../src/interfaces/persistence";

const LEGACY_LOCK_FILE = ".true-recall/device-lock.json";
const OWN_LOCK_FILE = ".true-recall/device-lock-device-abc-123.json";

class MockPersistence implements IPersistence {
	private textFiles = new Map<string, string>();
	private binaryFiles = new Map<string, ArrayBuffer>();

	async exists(path: string): Promise<boolean> {
		if (this.textFiles.has(path) || this.binaryFiles.has(path)) return true;
		const prefix = `${path}/`;
		return [...this.textFiles.keys(), ...this.binaryFiles.keys()].some((key) =>
			key.startsWith(prefix),
		);
	}

	async read(path: string): Promise<string> {
		const buf = this.binaryFiles.get(path);
		if (buf) {
			return new TextDecoder().decode(buf);
		}
		const content = this.textFiles.get(path);
		if (content === undefined) {
			throw new Error(`File not found: ${path}`);
		}
		return content;
	}

	async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
		this.binaryFiles.set(path, data);
	}

	async remove(path: string): Promise<void> {
		this.textFiles.delete(path);
		this.binaryFiles.delete(path);
	}

	async readBinary(_path: string): Promise<Uint8Array | null> {
		return null;
	}

	async mkdir(_path: string): Promise<void> {}

	async list(path: string): Promise<{ files: string[]; folders: string[] }> {
		const prefix = `${path}/`;
		const files = [...this.textFiles.keys(), ...this.binaryFiles.keys()].filter(
			(key) => key.startsWith(prefix),
		);
		return { files, folders: [] };
	}

	async stat(_path: string): Promise<{ size: number; mtime: number } | null> {
		return null;
	}

	/** Test helper: seed a text file directly */
	seedText(path: string, content: string): void {
		this.textFiles.set(path, content);
	}
}

describe("DeviceLockService", () => {
	let persistence: MockPersistence;
	let service: DeviceLockService;

	const DEVICE_ID = "device-abc-123";
	const PLATFORM = "desktop" as const;
	const LABEL = "My MacBook";

	beforeEach(() => {
		persistence = new MockPersistence();
		service = new DeviceLockService(persistence, DEVICE_ID, PLATFORM, LABEL);
	});

	afterEach(() => {
		service.stopHeartbeat();
		vi.useRealTimers();
	});

	describe("writeLock", () => {
		it("creates a lock file with correct fields", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));

			await service.writeLock();

			const lock = await service.readLock();
			expect(lock).not.toBeNull();
			expect(lock?.deviceId).toBe(DEVICE_ID);
			expect(lock?.platform).toBe(PLATFORM);
			expect(lock?.label).toBe(LABEL);
			expect(lock?.startedAt).toBe("2026-01-15T12:00:00.000Z");
			expect(lock?.lastActiveAt).toBe("2026-01-15T12:00:00.000Z");
		});
	});

	describe("readLock", () => {
		it("returns null when no file exists", async () => {
			const lock = await service.readLock();
			expect(lock).toBeNull();
		});

		it("returns lock data when own file exists with valid JSON", async () => {
			const validLock: DeviceLock = {
				deviceId: DEVICE_ID,
				platform: "desktop",
				label: "My MacBook",
				startedAt: "2026-01-15T10:00:00.000Z",
				lastActiveAt: "2026-01-15T11:00:00.000Z",
			};
			persistence.seedText(OWN_LOCK_FILE, JSON.stringify(validLock));

			const lock = await service.readLock();

			expect(lock).toEqual(validLock);
		});

		it("returns pessimistic lock on corrupt JSON", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
			persistence.seedText(OWN_LOCK_FILE, "not-valid-json{{{");

			const lock = await service.readLock();

			expect(lock).not.toBeNull();
			expect(lock?.deviceId).toBe("unknown");
			expect(lock?.platform).toBe("desktop");
			expect(lock?.label).toBe("Unknown device");
			expect(lock?.startedAt).toBe("2026-01-15T12:00:00.000Z");
			expect(lock?.lastActiveAt).toBe("2026-01-15T12:00:00.000Z");
		});

		it("returns pessimistic lock on invalid shape (missing fields)", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
			persistence.seedText(OWN_LOCK_FILE, JSON.stringify({ deviceId: "abc" }));

			const lock = await service.readLock();

			expect(lock).not.toBeNull();
			expect(lock?.deviceId).toBe("unknown");
		});
	});

	describe("clearLock", () => {
		it("removes the lock file", async () => {
			await service.writeLock();
			expect(await persistence.exists(OWN_LOCK_FILE)).toBe(true);

			await service.clearLock();

			expect(await persistence.exists(OWN_LOCK_FILE)).toBe(false);
		});

		it("succeeds when no lock exists", async () => {
			await expect(service.clearLock()).resolves.toBeUndefined();
		});
	});

	describe("isConflicting", () => {
		it("returns null when no lock exists", async () => {
			const result = await service.isConflicting();
			expect(result).toBeNull();
		});

		it("returns null when lock belongs to same device", async () => {
			await service.writeLock();

			const result = await service.isConflicting();

			expect(result).toBeNull();
		});

		it("returns lock when different device and not stale", async () => {
			vi.useFakeTimers();
			const now = new Date("2026-01-15T12:00:00.000Z");
			vi.setSystemTime(now);

			const otherLock: DeviceLock = {
				deviceId: "other-device",
				platform: "mobile",
				label: "iPhone",
				startedAt: now.toISOString(),
				lastActiveAt: now.toISOString(),
			};
			persistence.seedText(LEGACY_LOCK_FILE, JSON.stringify(otherLock));

			const result = await service.isConflicting();

			expect(result).not.toBeNull();
			expect(result?.deviceId).toBe("other-device");
			expect(result?.label).toBe("iPhone");
		});

		it("returns null when different device but stale (lastActiveAt > 120s ago)", async () => {
			vi.useFakeTimers();
			const lockTime = new Date("2026-01-15T12:00:00.000Z");
			const otherLock: DeviceLock = {
				deviceId: "other-device",
				platform: "mobile",
				label: "iPhone",
				startedAt: lockTime.toISOString(),
				lastActiveAt: lockTime.toISOString(),
			};
			persistence.seedText(LEGACY_LOCK_FILE, JSON.stringify(otherLock));

			// Advance past the 120s stale threshold
			vi.setSystemTime(new Date(lockTime.getTime() + 121_000));

			const result = await service.isConflicting();

			expect(result).toBeNull();
		});
	});

	describe("per-device lock files", () => {
		it("detects a fresh foreign per-device lock as a conflict", async () => {
			vi.useFakeTimers();
			const now = new Date("2026-01-15T12:00:00.000Z");
			vi.setSystemTime(now);

			const otherLock: DeviceLock = {
				deviceId: "phone9999",
				platform: "mobile",
				label: "iPhone",
				startedAt: now.toISOString(),
				lastActiveAt: now.toISOString(),
			};
			persistence.seedText(
				".true-recall/device-lock-phone9999.json",
				JSON.stringify(otherLock),
			);
			await service.writeLock();

			const result = await service.isConflicting();

			expect(result?.deviceId).toBe("phone9999");
		});

		it("two devices writing locks do not overwrite each other", async () => {
			const other = new DeviceLockService(
				persistence,
				"phone9999",
				"mobile",
				"iPhone",
			);
			await service.writeLock();
			await other.writeLock();

			expect(await persistence.exists(OWN_LOCK_FILE)).toBe(true);
			expect(
				await persistence.exists(".true-recall/device-lock-phone9999.json"),
			).toBe(true);
			expect((await service.readLock())?.deviceId).toBe(DEVICE_ID);
		});

		it("removes the legacy shared lock once it belongs to this device", async () => {
			const legacyOwn: DeviceLock = {
				deviceId: DEVICE_ID,
				platform: "desktop",
				label: LABEL,
				startedAt: "2026-01-15T10:00:00.000Z",
				lastActiveAt: "2026-01-15T10:00:00.000Z",
			};
			persistence.seedText(LEGACY_LOCK_FILE, JSON.stringify(legacyOwn));

			await service.writeLock();

			expect(await persistence.exists(LEGACY_LOCK_FILE)).toBe(false);
		});

		it("keeps a foreign legacy lock file in place", async () => {
			const legacyForeign: DeviceLock = {
				deviceId: "other-device",
				platform: "mobile",
				label: "iPhone",
				startedAt: "2026-01-15T10:00:00.000Z",
				lastActiveAt: "2026-01-15T10:00:00.000Z",
			};
			persistence.seedText(LEGACY_LOCK_FILE, JSON.stringify(legacyForeign));

			await service.writeLock();

			expect(await persistence.exists(LEGACY_LOCK_FILE)).toBe(true);
		});
	});

	describe("startHeartbeat", () => {
		it("updates lastActiveAt after interval elapses", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));

			await service.writeLock();
			service.startHeartbeat();

			// Advance by 60s (heartbeat interval) -- advanceTimersByTimeAsync
			// also advances the fake clock, so Date.now() will be 12:01:00
			await vi.advanceTimersByTimeAsync(60_000);

			const lock = await service.readLock();
			expect(lock).not.toBeNull();
			expect(lock?.lastActiveAt).toBe("2026-01-15T12:01:00.000Z");
		});
	});

	describe("stopHeartbeat", () => {
		it("stops the interval", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));

			await service.writeLock();
			service.startHeartbeat();
			service.stopHeartbeat();

			// Advance past the interval -- should NOT update since heartbeat is stopped
			await vi.advanceTimersByTimeAsync(60_000);

			const lock = await service.readLock();
			expect(lock).not.toBeNull();
			expect(lock?.lastActiveAt).toBe("2026-01-15T12:00:00.000Z");
		});
	});
});
