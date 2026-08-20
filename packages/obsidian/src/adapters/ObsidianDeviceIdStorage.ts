import type { App } from "obsidian";

import type { DeviceIdStorage } from "@true-recall/core/integration/device/device-id.service";

/**
 * Device-local storage backed by Obsidian's per-vault localStorage
 * (app.loadLocalStorage / app.saveLocalStorage). These keys are stored on
 * the device only and are never carried by vault sync, Obsidian Sync, or
 * data.json, which makes them the safe home for the device ID.
 *
 * Migration: earlier versions kept the ID in raw window.localStorage. On
 * first read of a missing key, a valid legacy value is adopted into the
 * vault-scoped storage so existing installs keep their identity (and their
 * database file).
 */
export class ObsidianDeviceIdStorage implements DeviceIdStorage {
	constructor(private readonly app: App) {}

	get(key: string): string | null {
		const value = this.app.loadLocalStorage(key);
		if (typeof value === "string" && value.length > 0) {
			return value;
		}

		const legacy = this.readLegacy(key);
		if (legacy) {
			this.app.saveLocalStorage(key, legacy);
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
}
