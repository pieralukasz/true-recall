/**
 * R-Mode settings defaults and migration.
 *
 * R-Mode is experimental and opt-in, so a fresh install and every existing
 * vault must both come up with the mode off and a complete config block —
 * a missing block is what made the queue silently fall back to due dates.
 */

import { describe, expect, it } from "vitest";

import { migrateSettings } from "../src/app/settings-migration";
import { DEFAULT_R_MODE_SETTINGS, DEFAULT_SETTINGS } from "../src/constants";

describe("R-Mode defaults", () => {
	it("ships disabled", () => {
		expect(DEFAULT_SETTINGS.rMode.enabled).toBe(false);
	});

	it("ships a usable session size", () => {
		expect(DEFAULT_SETTINGS.rMode.defaultSessionSize).toBeGreaterThan(0);
	});

	it("keeps the comfort mix inside the range the slider allows", () => {
		expect(DEFAULT_SETTINGS.rMode.comfortMix).toBeGreaterThanOrEqual(0);
		expect(DEFAULT_SETTINGS.rMode.comfortMix).toBeLessThanOrEqual(0.5);
	});

	it("keeps the saturation ceiling above the retention target", () => {
		expect(DEFAULT_SETTINGS.rMode.ceilingOffset).toBeGreaterThan(0);
		expect(
			DEFAULT_SETTINGS.fsrsRequestRetention +
				DEFAULT_SETTINGS.rMode.ceilingOffset,
		).toBeLessThan(1);
	});

	it("keeps the urgent threshold below the retention target", () => {
		expect(DEFAULT_SETTINGS.rMode.urgentBelow).toBeLessThan(
			DEFAULT_SETTINGS.fsrsRequestRetention,
		);
	});
});

describe("R-Mode migration", () => {
	it("fills the block in for vaults saved before R-Mode existed", () => {
		const { settings } = migrateSettings({ newCardsPerDay: 15 });

		expect(settings.rMode).toEqual(DEFAULT_R_MODE_SETTINGS);
		expect(settings.newCardsPerDay).toBe(15);
	});

	it("fills the block in for a null settings file", () => {
		const { settings } = migrateSettings(null);

		expect(settings.rMode).toEqual(DEFAULT_R_MODE_SETTINGS);
	});

	it("does not turn the mode on during migration", () => {
		expect(migrateSettings({}).settings.rMode.enabled).toBe(false);
	});

	it("preserves a user's saved R-Mode config", () => {
		const saved = {
			enabled: true,
			defaultSessionSize: 15,
			comfortMix: 0.5,
			ceilingOffset: 0.02,
			urgentBelow: 0.6,
		};

		const { settings } = migrateSettings({ rMode: saved });

		expect(settings.rMode).toEqual(saved);
	});
});
