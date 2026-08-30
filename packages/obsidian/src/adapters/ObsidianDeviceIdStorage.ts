import type { App } from "obsidian";

import type { DeviceIdStorage } from "@true-recall/core/integration/device/device-id.service";

/**
 * Device-local storage backed by Obsidian's per-vault localStorage
 * (app.loadLocalStorage / app.saveLocalStorage). These keys are stored on
 * the device only and are never carried by vault sync, Obsidian Sync, or
 * data.json, which makes them the safe home for the device ID.
 *
 * Earlier versions wrote these keys to raw local storage. A missing scoped
 * value is migrated once, then the legacy key is removed.
 */
export class ObsidianDeviceIdStorage implements DeviceIdStorage {
	constructor(private readonly app: App) {}

	get(key: string): string | null {
		const value: unknown = this.app.loadLocalStorage(key);
		if (typeof value === "string" && value.length > 0) {
			return value;
		}

		const legacy = this.readLegacy(key);
		if (legacy) {
			this.app.saveLocalStorage(key, legacy);
			this.removeLegacy(key);
		}
		return legacy;
	}

	set(key: string, value: string | null): void {
		this.app.saveLocalStorage(key, value);
	}

	private readLegacy(key: string): string | null {
		try {
			return window.localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	private removeLegacy(key: string): void {
		try {
			window.localStorage.removeItem(key);
		} catch {
			// The scoped value is already saved; stale cleanup is best-effort.
		}
	}
}
