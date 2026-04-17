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

	it("migrates language learning settings to a Vocabulary preset with TTS config", () => {
		const raw = {
			languageNoteTypeId: "lang-note-type",
			languageSource: "en",
			languageTtsEnabled: true,
			languageTtsField: "Audio",
			ttsVoice: "nova",
			ttsAutoplay: true,
		} as any;

		const { settings, needsSave } = migrateSettings(raw);

		expect(needsSave).toBe(true);
		const vocabPreset = settings.generationPresets.find(
			(p) => p.name === "Vocabulary",
		);
		expect(vocabPreset).toBeDefined();
		expect(vocabPreset?.noteTypeId).toBe("lang-note-type");
		expect(vocabPreset?.tts).toEqual({
			field: "Audio",
			voice: "nova",
			autoplay: true,
		});
		expect(vocabPreset?.isPinned).toBe(true);
		// vocab is the only preset here (no custom generationNoteTypeId), so it should be default
		expect(vocabPreset?.isDefault).toBe(true);
		expect(settings.defaultGenerationPresetId).toBe(vocabPreset?.id);
	});

	it("migrates language settings without TTS — tts is null", () => {
		const raw = {
			languageSource: "fr",
			languageTtsEnabled: false,
			languageTtsField: "",
		} as any;

		const { settings } = migrateSettings(raw);

		const vocabPreset = settings.generationPresets.find(
			(p) => p.name === "Vocabulary",
		);
		expect(vocabPreset).toBeDefined();
		expect(vocabPreset?.tts).toBeNull();
	});

	it("migrates toolbar buttons from flashcards/vocab to preset: prefixed IDs", () => {
		const raw = {
			editorToolbarButtons: [
				{ id: "other-button", enabled: true },
				{ id: "flashcards", enabled: true },
				{ id: "vocab", enabled: false },
			],
			globalToolbarButtons: [
				{ id: "flashcards", enabled: true },
				{ id: "vocab", enabled: true },
				{ id: "another", enabled: true },
			],
		} as any;

		const { settings } = migrateSettings(raw);

		// No flashcards or vocab IDs remain
		for (const btn of settings.editorToolbarButtons) {
			expect(btn.id).not.toBe("flashcards");
			expect(btn.id).not.toBe("vocab");
		}
		for (const btn of settings.globalToolbarButtons) {
			expect(btn.id).not.toBe("flashcards");
			expect(btn.id).not.toBe("vocab");
		}

		// Preset-prefixed buttons should exist
		const editorPresetBtns = settings.editorToolbarButtons.filter((b: any) =>
			b.id.startsWith("preset:"),
		);
		const globalPresetBtns = settings.globalToolbarButtons.filter((b: any) =>
			b.id.startsWith("preset:"),
		);
		expect(editorPresetBtns.length).toBeGreaterThan(0);
		expect(globalPresetBtns.length).toBeGreaterThan(0);

		// The non-preset button should still be present
		expect(
			settings.editorToolbarButtons.some((b: any) => b.id === "other-button"),
		).toBe(true);
		expect(
			settings.globalToolbarButtons.some((b: any) => b.id === "another"),
		).toBe(true);
	});

	it("creates both Flashcards and Vocabulary presets when both old settings exist", () => {
		const raw = {
			generationNoteTypeId: "custom-type",
			languageNoteTypeId: "lang-type",
			languageSource: "es",
		} as any;

		const { settings } = migrateSettings(raw);

		expect(settings.generationPresets).toHaveLength(3);
		const names = settings.generationPresets.map((p) => p.name);
		expect(names).toContain("Flashcards");
		expect(names).toContain("Vocabulary");
		expect(
			settings.generationPresets.some(
				(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
			),
		).toBe(true);

		// Flashcards is isDefault=true (added first), Vocabulary is isDefault=false
		const flashcards = settings.generationPresets.find(
			(p) => p.name === "Flashcards",
		);
		const vocab = settings.generationPresets.find(
			(p) => p.name === "Vocabulary",
		);
		expect(flashcards?.isDefault).toBe(true);
		expect(vocab?.isDefault).toBe(false);
		expect(settings.defaultGenerationPresetId).toBe(flashcards?.id);
	});
});
