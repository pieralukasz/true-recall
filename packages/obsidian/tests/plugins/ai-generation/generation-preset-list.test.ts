import { describe, expect, it } from "vitest";

import type { GenerationPreset } from "@true-recall/core";

import {
	applyUserPresetPatch,
	canSaveGenerationPresets,
	isGenerationPromptMissing,
	normalizeGenerationPresets,
} from "@true-recall/plugins/ai-generation/generation-preset-list";

function preset(overrides: Partial<GenerationPreset>): GenerationPreset {
	return {
		id: "p",
		name: "Preset",
		prompt: "Make cards",
		noteTypeId: "builtin-basic",
		requiresPro: false,
		builtin: false,
		isDefault: false,
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	};
}

const builtinDefault = preset({
	id: "builtin",
	builtin: true,
	isDefault: true,
});
const mine = preset({ id: "mine" });
const other = preset({ id: "other" });

describe("applyUserPresetPatch + normalizeGenerationPresets", () => {
	it("makes a user preset the default and keeps it after normalization", () => {
		const patched = applyUserPresetPatch(
			[builtinDefault, mine, other],
			"mine",
			{ isDefault: true },
			42,
		);
		const saved = normalizeGenerationPresets(patched);

		expect(saved.filter((p) => p.isDefault).map((p) => p.id)).toEqual(["mine"]);
		expect(saved.find((p) => p.id === "mine")?.updatedAt).toBe(42);
	});

	it("unticking the default falls back to the first preset", () => {
		const start = normalizeGenerationPresets(
			applyUserPresetPatch([builtinDefault, mine], "mine", {
				isDefault: true,
			}),
		);
		const saved = normalizeGenerationPresets(
			applyUserPresetPatch(start, "mine", { isDefault: false }),
		);

		expect(saved.filter((p) => p.isDefault).map((p) => p.id)).toEqual([
			"builtin",
		]);
	});

	it("leaves other defaults alone for edits that do not touch isDefault", () => {
		const patched = applyUserPresetPatch([builtinDefault, mine], "mine", {
			name: "Renamed",
		});

		expect(patched[0]).toBe(builtinDefault);
		expect(patched[1]?.name).toBe("Renamed");
	});

	it("never edits a built-in", () => {
		const patched = applyUserPresetPatch([builtinDefault, mine], "builtin", {
			prompt: "hacked",
		});

		expect(patched).toEqual([builtinDefault, mine]);
	});
});

describe("isGenerationPromptMissing", () => {
	it("flags empty and whitespace-only prompts", () => {
		expect(isGenerationPromptMissing(preset({ prompt: "" }))).toBe(true);
		expect(isGenerationPromptMissing(preset({ prompt: "  \n " }))).toBe(true);
		expect(isGenerationPromptMissing(preset({ prompt: "Cards" }))).toBe(false);
	});
});

describe("canSaveGenerationPresets", () => {
	it("blocks the save while a user preset has an empty prompt", () => {
		expect(
			canSaveGenerationPresets([builtinDefault, preset({ prompt: " " })]),
		).toBe(false);
	});

	it("allows the save when every user preset has a prompt", () => {
		expect(canSaveGenerationPresets([builtinDefault, preset({})])).toBe(true);
	});

	it("ignores built-ins, which are not edited here", () => {
		expect(
			canSaveGenerationPresets([
				preset({ id: "b", builtin: true, prompt: "" }),
				preset({}),
			]),
		).toBe(true);
	});
});
