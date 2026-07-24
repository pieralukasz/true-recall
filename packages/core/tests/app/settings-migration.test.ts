import { describe, expect, it } from "vitest";

import { migrateSettings } from "../../src/app/settings-migration";
import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRO_PRESET_ID,
} from "../../src/constants";
import type { GenerationPreset } from "../../src/types/generation-preset.types";

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
			builtin: true,
		});
		expect(
			settings.generationPresets.some(
				(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
			),
		).toBe(true);
		expect(settings.defaultGenerationPresetId).toBe(BUILTIN_BASIC_PRESET.id);
	});

	it("keeps already-migrated flat-shape presets untouched", () => {
		const existing: GenerationPreset = {
			id: "my-preset",
			name: "My Preset",
			prompt: "My prompt.",
			noteTypeId: "builtin-basic",
			requiresPro: false,
			builtin: false,
			isDefault: true,
			createdAt: 1000,
			updatedAt: 1000,
		};

		const { settings } = migrateSettings({
			generationPresets: [existing],
			defaultGenerationPresetId: "my-preset",
		} as unknown as Parameters<typeof migrateSettings>[0]);

		expect(
			settings.generationPresets.find((p) => p.id === "my-preset"),
		).toEqual(existing);
		expect(
			settings.generationPresets.some(
				(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
			),
		).toBe(true);
		expect(settings.defaultGenerationPresetId).toBe("my-preset");
	});

	it("migrates legacy per-field preset to flat shape", () => {
		const { settings, needsSave } = migrateSettings({
			generationPresets: [
				{
					id: "legacy-1",
					name: "Old Preset",
					noteTypeId: "builtin-basic",
					fields: {
						Front: { role: "ai-text", instruction: "Ask a question." },
						Back: { role: "ai-text", instruction: "Give an answer." },
					},
					customPrompt: "Focus on atomic facts.",
					isPinned: false,
					isDefault: true,
					createdAt: 1000,
					updatedAt: 1000,
				},
			],
		} as unknown as Parameters<typeof migrateSettings>[0]);

		expect(needsSave).toBe(true);
		const migrated = settings.generationPresets.find(
			(p) => p.id === "legacy-1",
		);
		expect(migrated).toBeDefined();
		expect(migrated?.prompt).toContain("Focus on atomic facts.");
		expect(migrated?.prompt).toContain('"Front"');
		expect(migrated?.prompt).toContain("Ask a question.");
		expect(migrated).not.toHaveProperty("fields");
		expect(migrated).not.toHaveProperty("customPrompt");
		expect(migrated).not.toHaveProperty("isPinned");
		expect(migrated?.builtin).toBe(false);
		expect(migrated?.requiresPro).toBe(false);
	});

	it("renames legacy isPro → requiresPro", () => {
		const { settings } = migrateSettings({
			generationPresets: [
				{
					id: "legacy-pro",
					name: "Pro Preset",
					noteTypeId: "basic",
					fields: { Front: { role: "ai-text", instruction: "Q" } },
					isPro: true,
					isPinned: false,
					isDefault: false,
					createdAt: 0,
					updatedAt: 0,
				},
			],
		} as unknown as Parameters<typeof migrateSettings>[0]);

		expect(
			settings.generationPresets.find((p) => p.id === "legacy-pro")
				?.requiresPro,
		).toBe(true);
	});

	it("retrofits builtin + requiresPro flags on seeded Pro preset", () => {
		const stalePro = {
			id: BUILTIN_BASIC_PRO_PRESET_ID,
			name: "Basic Flashcards (Pro)",
			prompt: "pro prompt",
			noteTypeId: "builtin-basic",
			requiresPro: false,
			builtin: false,
			isDefault: false,
			createdAt: 1,
			updatedAt: 1,
		};
		const { settings, needsSave } = migrateSettings({
			generationPresets: [stalePro],
			defaultGenerationPresetId: stalePro.id,
		} as unknown as Parameters<typeof migrateSettings>[0]);

		const pro = settings.generationPresets.find(
			(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
		);
		expect(pro?.requiresPro).toBe(true);
		expect(pro?.builtin).toBe(true);
		expect(needsSave).toBe(true);
	});

	it("drops deprecated flashcardGeneration bucket", () => {
		const { settings, needsSave } = migrateSettings({
			flashcardGeneration: {
				userPresets: [
					{
						id: "x",
						name: "leftover",
						prompt: "",
						autoApply: false,
						builtin: false,
					},
				],
				customPromptAutoApply: false,
			},
		} as unknown as Parameters<typeof migrateSettings>[0]);

		expect(
			(settings as unknown as Record<string, unknown>).flashcardGeneration,
		).toBeUndefined();
		expect(needsSave).toBe(true);
	});

	it("migrates old generationNoteTypeId to a Flashcards preset in flat shape", () => {
		const raw = {
			generationNoteTypeId: "my-custom-note-type",
			aiGenerationPrompt: "Custom prompt text",
		} as unknown as Parameters<typeof migrateSettings>[0];

		const { settings, needsSave } = migrateSettings(raw);

		expect(needsSave).toBe(true);
		const flashcardsPreset = settings.generationPresets.find(
			(p) => p.name === "Flashcards",
		);
		expect(flashcardsPreset).toBeDefined();
		expect(flashcardsPreset?.noteTypeId).toBe("my-custom-note-type");
		expect(flashcardsPreset?.prompt).toBe("Custom prompt text");
		expect(flashcardsPreset?.isDefault).toBe(true);
		expect(flashcardsPreset?.builtin).toBe(false);
		expect(settings.defaultGenerationPresetId).toBe(flashcardsPreset?.id);
	});

	it("does not create Flashcards preset when generationNoteTypeId is builtin-basic", () => {
		const raw = {
			generationNoteTypeId: "builtin-basic",
		} as unknown as Parameters<typeof migrateSettings>[0];

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
		} as unknown as Parameters<typeof migrateSettings>[0];

		const { settings } = migrateSettings(raw);

		for (const btn of settings.editorToolbarButtons) {
			expect(btn.id).not.toBe("flashcards");
		}
		for (const btn of settings.globalToolbarButtons) {
			expect(btn.id).not.toBe("flashcards");
		}

		const editorPresetBtns = settings.editorToolbarButtons.filter((b) =>
			b.id.startsWith("preset:"),
		);
		const globalPresetBtns = settings.globalToolbarButtons.filter((b) =>
			b.id.startsWith("preset:"),
		);
		expect(editorPresetBtns.length).toBeGreaterThan(0);
		expect(globalPresetBtns.length).toBeGreaterThan(0);

		expect(
			settings.editorToolbarButtons.some((b) => b.id === "other-button"),
		).toBe(true);
		expect(settings.globalToolbarButtons.some((b) => b.id === "another")).toBe(
			true,
		);
	});

	it("self-heals stale defaultGenerationPresetId pointing to a missing preset", () => {
		const proPreset = {
			id: BUILTIN_BASIC_PRO_PRESET_ID,
			name: "Basic Flashcards (Pro)",
			prompt: "pro prompt",
			noteTypeId: "builtin-basic",
			requiresPro: true,
			builtin: true,
			isDefault: false,
			createdAt: 1,
			updatedAt: 1,
		};
		const { settings, needsSave } = migrateSettings({
			generationPresets: [proPreset],
			defaultGenerationPresetId: "migrated-gen-1776345477398",
		} as unknown as Parameters<typeof migrateSettings>[0]);

		expect(needsSave).toBe(true);
		expect(settings.defaultGenerationPresetId).toBe(
			BUILTIN_BASIC_PRO_PRESET_ID,
		);
		const pro = settings.generationPresets.find(
			(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
		);
		expect(pro?.isDefault).toBe(true);
	});

	it("leaves defaultGenerationPresetId alone when it resolves to an existing preset", () => {
		const { settings, needsSave } = migrateSettings({
			generationPresets: [{ ...BUILTIN_BASIC_PRESET }],
			defaultGenerationPresetId: BUILTIN_BASIC_PRESET.id,
		} as unknown as Parameters<typeof migrateSettings>[0]);

		expect(settings.defaultGenerationPresetId).toBe(BUILTIN_BASIC_PRESET.id);
		void needsSave;
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
		} as unknown as Parameters<typeof migrateSettings>[0];

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

describe("migrateSettings — builtin Basic Pro toolbar button removal", () => {
	const basicButtonId = `preset:${BUILTIN_BASIC_PRESET.id}`;
	const proButtonId = `preset:${BUILTIN_BASIC_PRO_PRESET_ID}`;

	it("does not seed the Pro toolbar button on fresh install", () => {
		const { settings } = migrateSettings(null);
		expect(
			settings.editorToolbarButtons.some((b) => b.id === proButtonId),
		).toBe(false);
		expect(
			settings.globalToolbarButtons.some((b) => b.id === proButtonId),
		).toBe(false);
		expect(
			settings.editorToolbarButtons.some((b) => b.id === basicButtonId),
		).toBe(true);
	});

	it("strips the Pro toolbar button from persisted settings", () => {
		const raw = {
			generationPresets: [{ ...BUILTIN_BASIC_PRESET }],
			defaultGenerationPresetId: BUILTIN_BASIC_PRESET.id,
			editorToolbarButtons: [
				{ id: basicButtonId, enabled: true },
				{ id: proButtonId, enabled: true },
				{ id: "copy", enabled: true },
			],
			globalToolbarButtons: [
				{ id: basicButtonId, enabled: true },
				{ id: proButtonId, enabled: true },
			],
		} as unknown as Parameters<typeof migrateSettings>[0];

		const { settings, needsSave } = migrateSettings(raw);

		expect(needsSave).toBe(true);
		expect(
			settings.editorToolbarButtons.some((b) => b.id === proButtonId),
		).toBe(false);
		expect(
			settings.globalToolbarButtons.some((b) => b.id === proButtonId),
		).toBe(false);
		expect(
			settings.editorToolbarButtons.some((b) => b.id === basicButtonId),
		).toBe(true);
		expect(settings.editorToolbarButtons.some((b) => b.id === "copy")).toBe(
			true,
		);
	});

	it("replaces a lone Pro toolbar button with the basic one, keeping position and enabled state", () => {
		const raw = {
			generationPresets: [{ ...BUILTIN_BASIC_PRESET }],
			defaultGenerationPresetId: BUILTIN_BASIC_PRESET.id,
			editorToolbarButtons: [
				{ id: "copy", enabled: true },
				{ id: proButtonId, enabled: false },
			],
			globalToolbarButtons: [{ id: proButtonId, enabled: true }],
		} as unknown as Parameters<typeof migrateSettings>[0];

		const { settings } = migrateSettings(raw);

		expect(settings.editorToolbarButtons[1]).toMatchObject({
			id: basicButtonId,
			enabled: false,
		});
		expect(
			settings.editorToolbarButtons.some((b) => b.id === proButtonId),
		).toBe(false);
		expect(settings.globalToolbarButtons[0]).toMatchObject({
			id: basicButtonId,
			enabled: true,
		});
	});

	it("does not duplicate the basic button when both were present", () => {
		const raw = {
			generationPresets: [{ ...BUILTIN_BASIC_PRESET }],
			defaultGenerationPresetId: BUILTIN_BASIC_PRESET.id,
			editorToolbarButtons: [
				{ id: basicButtonId, enabled: true },
				{ id: proButtonId, enabled: true },
			],
			globalToolbarButtons: [{ id: basicButtonId, enabled: true }],
		} as unknown as Parameters<typeof migrateSettings>[0];

		const { settings } = migrateSettings(raw);

		expect(
			settings.editorToolbarButtons.filter((b) => b.id === basicButtonId),
		).toHaveLength(1);
		expect(
			settings.globalToolbarButtons.filter((b) => b.id === basicButtonId),
		).toHaveLength(1);
	});
});

describe("providerType migration", () => {
	it("derives providerType='pro' when proKey is present", () => {
		const result = migrateSettings({
			proKey: "pk_test",
		} as unknown as Parameters<typeof migrateSettings>[0]);
		expect(result.settings.providerType).toBe("pro");
		expect(result.settings.aiTier).toBe("pro");
		expect(result.needsSave).toBe(true);
	});

	it("derives providerType='openrouter' when openRouterApiKey is present", () => {
		const result = migrateSettings({
			openRouterApiKey: "sk_test",
		} as unknown as Parameters<typeof migrateSettings>[0]);
		expect(result.settings.providerType).toBe("openrouter");
		expect(result.settings.aiTier).toBe("byok");
		expect(result.needsSave).toBe(true);
	});

	it("defaults to openrouter when no keys are present", () => {
		const result = migrateSettings(
			{} as unknown as Parameters<typeof migrateSettings>[0],
		);
		expect(result.settings.providerType).toBe("openrouter");
		expect(result.settings.aiTier).toBe("byok");
		expect(result.needsSave).toBe(true);
	});

	it("preserves explicit providerType='custom'", () => {
		const result = migrateSettings({
			providerType: "custom",
			customModel: "llama3",
		} as unknown as Parameters<typeof migrateSettings>[0]);
		expect(result.settings.providerType).toBe("custom");
		expect(result.settings.aiTier).toBe("custom");
		expect(result.settings.customModel).toBe("llama3");
	});

	it("syncs aiTier when providerType changes from pro to custom", () => {
		const result = migrateSettings({
			providerType: "custom",
			aiTier: "pro" as AITier,
			customModel: "gemma2",
		} as unknown as Parameters<typeof migrateSettings>[0]);
		expect(result.settings.aiTier).toBe("custom");
	});
});

describe("migrateSettings — ask-ai toolbar button backfill", () => {
	it("appends ask-ai to saved editor and global toolbar arrays", () => {
		const raw = {
			editorToolbarButtons: [{ id: "quick-add", enabled: true }],
			globalToolbarButtons: [{ id: "copy", enabled: false }],
		} as unknown as Parameters<typeof migrateSettings>[0];
		const { settings, needsSave } = migrateSettings(raw);
		expect(needsSave).toBe(true);
		expect(
			settings.editorToolbarButtons.some((b) => b.id === "ask-ai" && b.enabled),
		).toBe(true);
		expect(
			settings.globalToolbarButtons.some((b) => b.id === "ask-ai" && b.enabled),
		).toBe(true);
	});

	it("is idempotent when ask-ai is already present and preserves the user's choice", () => {
		const raw = {
			editorToolbarButtons: [{ id: "ask-ai", enabled: false }],
			globalToolbarButtons: [{ id: "ask-ai", enabled: true }],
		} as unknown as Parameters<typeof migrateSettings>[0];
		const { settings } = migrateSettings(raw);
		expect(
			settings.editorToolbarButtons.filter((b) => b.id === "ask-ai"),
		).toHaveLength(1);
		expect(
			settings.editorToolbarButtons.find((b) => b.id === "ask-ai")?.enabled,
		).toBe(false);
	});
});
