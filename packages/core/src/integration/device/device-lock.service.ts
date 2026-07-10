import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import { DB_FOLDER } from "@true-recall/core/persistence/sqlite/sqlite.types";

const LOCK_FILE = `${DB_FOLDER}/device-lock.json`;
const HEARTBEAT_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = 120_000;

export interface DeviceLock {
	deviceId: string;
	platform: "desktop" | "mobile";
	label: string;
	startedAt: string;
	lastActiveAt: string;
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

export class DeviceLockService {
	private heartbeatTimer: number | null = null;
	private consecutiveHeartbeatFailures = 0;

	constructor(
		private persistence: IPersistence,
		private deviceId: string,
		private platform: "desktop" | "mobile",
		private label: string,
	) {}

	async writeLock(): Promise<void> {
		const lock: DeviceLock = {
			deviceId: this.deviceId,
			platform: this.platform,
			label: this.label,
			startedAt: new Date().toISOString(),
			lastActiveAt: new Date().toISOString(),
		};
		await this.writeLockFile(lock);
	}

	async readLock(): Promise<DeviceLock | null> {
		const exists = await this.persistence.exists(LOCK_FILE);
		if (!exists) return null;
		try {
			const content = await this.persistence.read(LOCK_FILE);
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

	async clearLock(): Promise<void> {
		this.stopHeartbeat();
		try {
			const exists = await this.persistence.exists(LOCK_FILE);
			if (exists) {
				await this.persistence.remove(LOCK_FILE);
			}
		} catch (err) {
			console.warn("[True Recall] Failed to clear device lock:", err);
		}
	}

	async isConflicting(): Promise<DeviceLock | null> {
		const lock = await this.readLock();
		if (!lock) return null;
		if (lock.deviceId === this.deviceId) return null;

		const lastActive = new Date(lock.lastActiveAt).getTime();
		const elapsed = Date.now() - lastActive;
		if (elapsed < STALE_THRESHOLD_MS) {
			return lock;
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

	private async updateHeartbeat(): Promise<void> {
		try {
			const lock = await this.readLock();
			if (!lock || lock.deviceId !== this.deviceId) return;
			lock.lastActiveAt = new Date().toISOString();
			await this.writeLockFile(lock);
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
			LOCK_FILE,
			encoded.buffer as ArrayBuffer,
		);
	}
}
