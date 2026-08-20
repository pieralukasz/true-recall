import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import {
	DB_FOLDER,
	toExactArrayBuffer,
} from "@true-recall/core/persistence/sqlite/sqlite.types";

/** Pre-per-device-lock versions shared one file that devices overwrote. */
const LEGACY_LOCK_FILE = `${DB_FOLDER}/device-lock.json`;
const LOCK_FILENAME_PATTERN = /^device-lock-(.+)\.json$/;
const HEARTBEAT_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = 120_000;

export interface DeviceLock {
	deviceId: string;
	platform: "desktop" | "mobile";
	label: string;
	startedAt: string;
	lastActiveAt: string;
}

export function getDeviceLockPath(deviceId: string): string {
	return `${DB_FOLDER}/device-lock-${deviceId}.json`;
}

function isValidDeviceLock(value: unknown): value is DeviceLock {
	if (typeof value !== "object" || value === null) return false;
	const obj = value as Record<string, unknown>;
	return (
		typeof obj.deviceId === "string" &&
		typeof obj.lastActiveAt === "string" &&
		typeof obj.platform === "string" &&
		typeof obj.label === "string" &&
		typeof obj.startedAt === "string"
	);
}

function pessimisticLock(): DeviceLock {
	const now = new Date().toISOString();
	return {
		deviceId: "unknown",
		platform: "desktop",
		label: "Unknown device",
		startedAt: now,
		lastActiveAt: now,
	};
}

function isFresh(lock: DeviceLock): boolean {
	const lastActive = new Date(lock.lastActiveAt).getTime();
	return Date.now() - lastActive < STALE_THRESHOLD_MS;
}

/**
 * Presence signal for concurrently running devices. Each device writes and
 * heartbeats its OWN lock file (device-lock-<id>.json), so two devices never
 * overwrite each other's lock; a conflict is any fresh foreign lock file.
 */
export class DeviceLockService {
	private heartbeatTimer: number | null = null;
	private consecutiveHeartbeatFailures = 0;
	private startedAt: string | null = null;

	constructor(
		private persistence: IPersistence,
		private deviceId: string,
		private platform: "desktop" | "mobile",
		private label: string,
	) {}

	private get ownLockFile(): string {
		return getDeviceLockPath(this.deviceId);
	}

	async writeLock(): Promise<void> {
		const now = new Date().toISOString();
		this.startedAt = this.startedAt ?? now;
		const lock: DeviceLock = {
			deviceId: this.deviceId,
			platform: this.platform,
			label: this.label,
			startedAt: this.startedAt,
			lastActiveAt: now,
		};
		await this.writeLockFile(lock);
		await this.cleanupLegacyLock();
	}

	/** Read this device's own lock file (null when absent). */
	async readLock(): Promise<DeviceLock | null> {
		return this.readLockAt(this.ownLockFile);
	}

	async clearLock(): Promise<void> {
		this.stopHeartbeat();
		try {
			if (await this.persistence.exists(this.ownLockFile)) {
				await this.persistence.remove(this.ownLockFile);
			}
			await this.cleanupLegacyLock();
		} catch (err) {
			console.warn("[True Recall] Failed to clear device lock:", err);
		}
	}

	/**
	 * Return the first fresh lock held by another device, scanning both the
	 * per-device lock files and the legacy shared file.
	 */
	async isConflicting(): Promise<DeviceLock | null> {
		for (const lock of await this.readForeignLocks()) {
			if (isFresh(lock)) return lock;
		}
		return null;
	}

	startHeartbeat(): void {
		this.stopHeartbeat();
		this.consecutiveHeartbeatFailures = 0;
		this.heartbeatTimer = window.setInterval(() => {
			void this.updateHeartbeat();
		}, HEARTBEAT_INTERVAL_MS);
	}

	stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			window.clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private async readForeignLocks(): Promise<DeviceLock[]> {
		const locks: DeviceLock[] = [];

		try {
			if (await this.persistence.exists(DB_FOLDER)) {
				const items = await this.persistence.list(DB_FOLDER);
				for (const filePath of items.files) {
					const filename = filePath.split("/").pop() ?? "";
					const match = LOCK_FILENAME_PATTERN.exec(filename);
					if (!match || match[1] === this.deviceId) continue;
					const lock = await this.readLockAt(filePath);
					if (lock && lock.deviceId !== this.deviceId) locks.push(lock);
				}
			}
		} catch (err) {
			console.warn("[True Recall] Failed to scan device locks:", err);
		}

		const legacy = await this.readLockAt(LEGACY_LOCK_FILE);
		if (legacy && legacy.deviceId !== this.deviceId) locks.push(legacy);

		return locks;
	}

	private async readLockAt(path: string): Promise<DeviceLock | null> {
		const exists = await this.persistence.exists(path);
		if (!exists) return null;
		try {
			const content = await this.persistence.read(path);
			const parsed: unknown = JSON.parse(content);
			if (!isValidDeviceLock(parsed)) {
				console.warn(
					"[True Recall] Device lock file has unexpected shape, treating as locked",
				);
				return pessimisticLock();
			}
			return parsed;
		} catch (err) {
			console.warn(
				"[True Recall] Failed to read device lock file, treating as potentially locked:",
				err,
			);
			return pessimisticLock();
		}
	}

	/** Remove the legacy shared lock file once it belongs to this device. */
	private async cleanupLegacyLock(): Promise<void> {
		try {
			if (!(await this.persistence.exists(LEGACY_LOCK_FILE))) return;
			const legacy = await this.readLockAt(LEGACY_LOCK_FILE);
			if (legacy && legacy.deviceId === this.deviceId) {
				await this.persistence.remove(LEGACY_LOCK_FILE);
			}
		} catch (err) {
			console.debug("[True Recall] Legacy lock cleanup failed:", err);
		}
	}

	private async updateHeartbeat(): Promise<void> {
		try {
			await this.writeLock();
			this.consecutiveHeartbeatFailures = 0;
		} catch (err) {
			this.consecutiveHeartbeatFailures++;
			if (this.consecutiveHeartbeatFailures >= 2) {
				console.warn(
					`[True Recall] Heartbeat update failed ${this.consecutiveHeartbeatFailures} times:`,
					err,
				);
			} else {
				console.debug("[True Recall] Heartbeat update failed:", err);
			}
		}
	}

	private async writeLockFile(lock: DeviceLock): Promise<void> {
		const json = JSON.stringify(lock, null, "\t");
		const encoded = new TextEncoder().encode(json);
		await this.persistence.writeBinary(
			this.ownLockFile,
			toExactArrayBuffer(encoded),
		);
	}
}
