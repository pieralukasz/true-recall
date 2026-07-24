import { describe, expect, it } from "vitest";

import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRO_PRESET,
	BUILTIN_BASIC_PRO_PRESET_ID,
} from "../../../src/constants";
import { resolveGenerationPresetForTier } from "../../../src/flashcard/presets/resolve-preset-for-tier";
import type { GenerationPreset } from "../../../src/types/generation-preset.types";

const customPreset: GenerationPreset = {
	id: "custom-1",
	name: "My Preset",
	prompt: "Custom prompt.",
	noteTypeId: "builtin-basic",
	requiresPro: false,
	builtin: false,
	isDefault: false,
	createdAt: 0,
	updatedAt: 0,
};

const allPresets = [
	{ ...BUILTIN_BASIC_PRESET },
	{ ...BUILTIN_BASIC_PRO_PRESET },
	customPreset,
];

describe("resolveGenerationPresetForTier", () => {
	it("upgrades the builtin basic preset to the Pro variant for Pro users", () => {
		const resolved = resolveGenerationPresetForTier(
			allPresets,
			BUILTIN_BASIC_PRESET.id,
			true,
		);
		expect(resolved?.id).toBe(BUILTIN_BASIC_PRO_PRESET_ID);
	});

	it("keeps the builtin basic preset for non-Pro users", () => {
		const resolved = resolveGenerationPresetForTier(
			allPresets,
			BUILTIN_BASIC_PRESET.id,
			false,
		);
		expect(resolved?.id).toBe(BUILTIN_BASIC_PRESET.id);
	});

	it("keeps the builtin basic preset when the Pro variant is missing", () => {
		const resolved = resolveGenerationPresetForTier(
			[{ ...BUILTIN_BASIC_PRESET }, customPreset],
			BUILTIN_BASIC_PRESET.id,
			true,
		);
		expect(resolved?.id).toBe(BUILTIN_BASIC_PRESET.id);
	});

	it("returns explicitly requested presets unchanged", () => {
		expect(
			resolveGenerationPresetForTier(allPresets, customPreset.id, true)?.id,
		).toBe(customPreset.id);
		expect(
			resolveGenerationPresetForTier(
				allPresets,
				BUILTIN_BASIC_PRO_PRESET_ID,
				false,
			)?.id,
		).toBe(BUILTIN_BASIC_PRO_PRESET_ID);
	});

	it("returns null for an unknown preset id", () => {
		expect(resolveGenerationPresetForTier(allPresets, "missing", true)).toBe(
			null,
		);
	});
});
