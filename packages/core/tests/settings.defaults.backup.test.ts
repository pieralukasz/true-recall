import { DEFAULT_SETTINGS } from "../src/constants";
import { describe, expect, it } from "vitest";

describe("backup defaults", () => {
	it("new install defaults to periodic backup (60 min) with startup backup disabled", () => {
		expect(DEFAULT_SETTINGS.periodicBackupEnabled).toBe(true);
		expect(DEFAULT_SETTINGS.backupIntervalMinutes).toBe(60);
		expect(DEFAULT_SETTINGS.autoBackupOnLoad).toBe(false);
		expect(DEFAULT_SETTINGS.activityTriggeredBackup).toBe(false);
	});

	it("preserves existing user backup flags when loading saved settings", () => {
		const saved = {
			periodicBackupEnabled: false,
			autoBackupOnLoad: true,
			backupIntervalMinutes: 120 as const,
		};

		// Mirrors plugin loadSettings behavior (Object.assign with defaults first).
		const merged = Object.assign({}, DEFAULT_SETTINGS, saved);

		expect(merged.periodicBackupEnabled).toBe(false);
		expect(merged.autoBackupOnLoad).toBe(true);
		expect(merged.backupIntervalMinutes).toBe(120);
	});
});
