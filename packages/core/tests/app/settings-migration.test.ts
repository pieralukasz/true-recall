import { describe, expect, it } from "vitest";

import { migrateSettings } from "../../src/app/settings-migration";
import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRO_PRESET_ID,
} from "../../src/constants";

describe("migrateSettings — generation preset migration", () => {
	it("creates default preset for fresh install", () => {
		const { settings, needsSave } = migrateSettings(null);

		expect(needsSave).toBe(true);
		expect(settings.generationPresets).toHaveLength(2);
		const basic = settings.generationPresets.find(
			(p) => p.id === BUILTIN_BASIC_PRESET.id,
		);
		expect(basic).toMatchObject({
			id: BUILTIN_BASIC_PRESET.id,
			name: BUILTIN_BASIC_PRESET.name,
			noteTypeId: BUILTIN_BASIC_PRESET.noteTypeId,
			isDefault: true,
		});
		expect(
			settings.generationPresets.some(
				(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
			),
		).toBe(true);
		expect(settings.defaultGenerationPresetId).toBe(BUILTIN_BASIC_PRESET.id);
	});

	it("preserves existing presets if already migrated", () => {
		const existingPresets = [
			{
				id: "my-preset",
				name: "My Preset",
				noteTypeId: "builtin-basic",
				fields: {},
				tts: null,
				isPinned: true,
				isDefault: true,
				createdAt: 1000,
				updatedAt: 1000,
			},
		];

		const { settings } = migrateSettings({
			generationPresets: existingPresets,
			defaultGenerationPresetId: "my-preset",
		} as any);

		expect(
			settings.generationPresets.find((p) => p.id === "my-preset"),
		).toEqual(existingPresets[0]);
		expect(
			settings.generationPresets.some(
				(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
			),
		).toBe(true);
		expect(settings.defaultGenerationPresetId).toBe("my-preset");
	});

	it("retrofits isPro on pre-existing Pro preset that lacks the flag", () => {
		const stalePro = {
			id: BUILTIN_BASIC_PRO_PRESET_ID,
			name: "Basic Flashcards (Pro)",
			noteTypeId: "builtin-basic",
			fields: {},
			tts: null,
			isPinned: true,
			isDefault: false,
			createdAt: 1,
			updatedAt: 1,
		};
		const { settings, needsSave } = migrateSettings({
			generationPresets: [stalePro],
			defaultGenerationPresetId: stalePro.id,
		} as any);

		const pro = settings.generationPresets.find(
			(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
		);
		expect(pro?.isPro).toBe(true);
		expect(needsSave).toBe(true);
	});

	it("migrates old generationNoteTypeId to a Flashcards preset", () => {
		const raw = {
			generationNoteTypeId: "my-custom-note-type",
			aiGenerationPrompt: "Custom prompt text",
		} as any;

		const { settings, needsSave } = migrateSettings(raw);

		expect(needsSave).toBe(true);
		const flashcardsPreset = settings.generationPresets.find(
			(p) => p.name === "Flashcards",
		);
		expect(flashcardsPreset).toBeDefined();
		expect(flashcardsPreset?.noteTypeId).toBe("my-custom-note-type");
		expect(flashcardsPreset?.customPrompt).toBe("Custom prompt text");
		expect(flashcardsPreset?.isDefault).toBe(true);
		expect(flashcardsPreset?.isPinned).toBe(true);
		expect(settings.defaultGenerationPresetId).toBe(flashcardsPreset?.id);
	});

	it("does not create Flashcards preset when generationNoteTypeId is builtin-basic", () => {
		const raw = {
			generationNoteTypeId: "builtin-basic",
		} as any;

		const { settings } = migrateSettings(raw);

		const flashcardsPreset = settings.generationPresets.find(
			(p) => p.name === "Flashcards",
		);
		expect(flashcardsPreset).toBeUndefined();
	});

	it('migrates legacy "flashcards" toolbar buttons to preset: prefixed IDs', () => {
		const raw = {
			editorToolbarButtons: [
				{ id: "other-button", enabled: true },
				{ id: "flashcards", enabled: true },
			],
			globalToolbarButtons: [
				{ id: "flashcards", enabled: true },
				{ id: "another", enabled: true },
			],
		} as any;

		const { settings } = migrateSettings(raw);

		for (const btn of settings.editorToolbarButtons) {
			expect(btn.id).not.toBe("flashcards");
		}
		for (const btn of settings.globalToolbarButtons) {
			expect(btn.id).not.toBe("flashcards");
		}

		const editorPresetBtns = settings.editorToolbarButtons.filter((b: any) =>
			b.id.startsWith("preset:"),
		);
		const globalPresetBtns = settings.globalToolbarButtons.filter((b: any) =>
			b.id.startsWith("preset:"),
		);
		expect(editorPresetBtns.length).toBeGreaterThan(0);
		expect(globalPresetBtns.length).toBeGreaterThan(0);

		expect(
			settings.editorToolbarButtons.some((b: any) => b.id === "other-button"),
		).toBe(true);
		expect(
			settings.globalToolbarButtons.some((b: any) => b.id === "another"),
		).toBe(true);
	});

	it('strips legacy "vocab" toolbar button from persisted settings', () => {
		const raw = {
			generationPresets: [{ ...BUILTIN_BASIC_PRESET }],
			defaultGenerationPresetId: BUILTIN_BASIC_PRESET.id,
			editorToolbarButtons: [
				{ id: "preset:builtin-basic-flashcards", enabled: true },
				{ id: "vocab", enabled: true },
				{ id: "copy", enabled: true },
			],
			globalToolbarButtons: [
				{ id: "vocab", enabled: true },
				{ id: "copy", enabled: true },
			],
		} as any;

		const { settings, needsSave } = migrateSettings(raw);

		expect(needsSave).toBe(true);
		expect(settings.editorToolbarButtons.some((b) => b.id === "vocab")).toBe(
			false,
		);
		expect(settings.globalToolbarButtons.some((b) => b.id === "vocab")).toBe(
			false,
		);
	});
});
