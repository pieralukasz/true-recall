import { describe, expect, it } from "vitest";

import { resolveGenerationPresetAndNoteType } from "@true-recall/core/ai/generation/preset-resolver";
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
	noteTypeId: "nt-basic",
	fields: {
		Front: { role: "ai-text", instruction: "Question" },
		Back: { role: "ai-text", instruction: "Answer" },
	},
	tts: null,
	isPinned: true,
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

	it("throws when tts.field does not match any preset field", () => {
		const settings = makeSettings({
			generationPresets: [
				{
					...basicPreset,
					tts: { field: "Missing", voice: "en-US", autoplay: false },
				},
			],
		});
		expect(() =>
			resolveGenerationPresetAndNoteType(
				settings,
				managerWithBasic,
				basicPreset.id,
			),
		).toThrow(
			'Preset "preset-basic" has TTS configured for field "Missing" which is not in the preset\'s fields',
		);
	});
});
