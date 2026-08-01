import { describe, expect, it } from "vitest";

import {
	resolveGenerationPresetAndNoteType,
	resolveGenerationTarget,
} from "@true-recall/core/ai/generation/preset-resolver";
import {
	BUILTIN_BASIC_PRESET_ID,
	BUILTIN_BASIC_PRO_PRESET_ID,
} from "@true-recall/core/constants";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";
import type { NoteType } from "@true-recall/core/types/note.types";
import type { TrueRecallSettings } from "@true-recall/core/types/settings.types";

const basicNoteType: NoteType = {
	id: "nt-basic",
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

const basicPreset: GenerationPreset = {
	id: "preset-basic",
	name: "Basic",
	prompt: "Make flashcards.",
	noteTypeId: "nt-basic",
	requiresPro: false,
	builtin: false,
	isDefault: true,
	createdAt: 0,
	updatedAt: 0,
};

function makeSettings(
	overrides: Partial<TrueRecallSettings> = {},
): TrueRecallSettings {
	return {
		generationPresets: [basicPreset],
		defaultGenerationPresetId: basicPreset.id,
		...overrides,
	} as TrueRecallSettings;
}

const managerWithBasic = {
	getNoteTypeById: (id: string) =>
		id === basicNoteType.id ? basicNoteType : null,
};

describe("resolveGenerationPresetAndNoteType", () => {
	it("returns preset and note type when both resolve", () => {
		const result = resolveGenerationPresetAndNoteType(
			makeSettings(),
			managerWithBasic,
			"preset-basic",
		);
		expect(result.preset).toBe(basicPreset);
		expect(result.noteType).toBe(basicNoteType);
	});

	it("throws when preset id is not found", () => {
		expect(() =>
			resolveGenerationPresetAndNoteType(
				makeSettings(),
				managerWithBasic,
				"missing-preset",
			),
		).toThrow('Generation preset "missing-preset" not found');
	});

	it("throws when preset's noteTypeId does not resolve", () => {
		const settings = makeSettings({
			generationPresets: [{ ...basicPreset, noteTypeId: "ghost-note-type" }],
		});
		expect(() =>
			resolveGenerationPresetAndNoteType(
				settings,
				managerWithBasic,
				basicPreset.id,
			),
		).toThrow(
			'Preset "preset-basic" references unknown note type "ghost-note-type"',
		);
	});
});

describe("resolveGenerationTarget", () => {
	const builtinBasic: GenerationPreset = {
		...basicPreset,
		id: BUILTIN_BASIC_PRESET_ID,
		name: "Basic Flashcards",
		builtin: true,
	};
	const builtinPro: GenerationPreset = {
		...basicPreset,
		id: BUILTIN_BASIC_PRO_PRESET_ID,
		name: "Basic Flashcards (Pro)",
		builtin: true,
		requiresPro: true,
		isDefault: false,
	};

	it("swaps the plain built-in for its Pro counterpart when the user has Pro", () => {
		const settings = makeSettings({
			generationPresets: [builtinBasic, builtinPro],
			proKey: "pro-key",
		});

		const result = resolveGenerationTarget(
			settings,
			managerWithBasic,
			BUILTIN_BASIC_PRESET_ID,
		);

		expect(result.preset.id).toBe(BUILTIN_BASIC_PRO_PRESET_ID);
	});

	it("keeps the plain built-in without Pro", () => {
		const settings = makeSettings({
			generationPresets: [builtinBasic, builtinPro],
		});

		const result = resolveGenerationTarget(
			settings,
			managerWithBasic,
			BUILTIN_BASIC_PRESET_ID,
		);

		expect(result.preset.id).toBe(BUILTIN_BASIC_PRESET_ID);
	});

	it("passes a custom preset through untouched even on Pro", () => {
		const settings = makeSettings({
			generationPresets: [basicPreset, builtinPro],
			proKey: "pro-key",
		});

		const result = resolveGenerationTarget(
			settings,
			managerWithBasic,
			basicPreset.id,
		);

		expect(result.preset.id).toBe(basicPreset.id);
	});

	it("rejects a Pro-only preset when the user has no Pro key", () => {
		const settings = makeSettings({ generationPresets: [builtinPro] });

		expect(() =>
			resolveGenerationTarget(
				settings,
				managerWithBasic,
				BUILTIN_BASIC_PRO_PRESET_ID,
			),
		).toThrow(/requires True Recall Pro/);
	});
});
