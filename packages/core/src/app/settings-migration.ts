import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRO_PRESET,
	BUILTIN_BASIC_PRO_PRESET_ID,
	DEFAULT_SETTINGS,
} from "../constants";
import type { GenerationPreset } from "../types/generation-preset.types";
import type { TrueRecallSettings } from "../types/settings.types";

/**
 * Merge raw persisted data with defaults and run all migrations.
 * Pure function — no side effects.
 */
export function migrateSettings(raw: Partial<TrueRecallSettings> | null): {
	settings: TrueRecallSettings;
	needsSave: boolean;
} {
	const settings: TrueRecallSettings = { ...DEFAULT_SETTINGS, ...raw };
	let needsSave = false;

	// easyDays: array → object migration
	if (Array.isArray(settings.easyDays)) {
		settings.easyDays = {
			recurringDays: settings.easyDays as unknown as number[],
			specificDates: [],
		};
	}

	// Backfill new preset fields for existing presets
	if (settings.fsrsPresets) {
		for (const preset of settings.fsrsPresets) {
			preset.leechThreshold ??= 8;
			preset.leechAction ??= "tag-only";
			preset.newCardOrder ??= settings.newCardOrder;
			preset.reviewOrder ??= settings.reviewOrder;
			preset.newReviewMix ??= settings.newReviewMix;
		}
	}

	// Migrate global FSRS settings → Default preset for existing users
	if (!raw?.fsrsPresets) {
		settings.fsrsPresets = [
			{
				id: "default",
				name: "Default",
				requestRetention: settings.fsrsRequestRetention,
				maximumInterval: settings.fsrsMaximumInterval,
				weights: settings.fsrsWeights,
				learningSteps: settings.learningSteps,
				relearningSteps: settings.relearningSteps,
				newCardsPerDay: settings.newCardsPerDay,
				reviewsPerDay: settings.reviewsPerDay,
				createdAt: Date.now(),
				lastOptimization: settings.lastOptimization,
				lastOptimizationReviewCount: settings.lastOptimizationReviewCount,
				lastOptimizationMetrics: settings.lastOptimizationMetrics,
			},
		];
		settings.defaultPresetId = "default";
		needsSave = true;
	}

	// Strip legacy "vocab" toolbar button from persisted settings (the button
	// has been replaced by preset:* IDs; migration used to re-inject it on
	// every load, leaving a zombie entry in user settings).
	for (const key of ["editorToolbarButtons", "globalToolbarButtons"] as const) {
		if (raw?.[key] && settings[key].some((b) => b.id === "vocab")) {
			settings[key] = settings[key].filter((b) => b.id !== "vocab");
			needsSave = true;
		}
	}

	// Inject built-in Basic Pro preset toolbar button for existing users
	const basicPresetButtonId = "preset:builtin-basic-flashcards";
	const basicProButtonId = `preset:${BUILTIN_BASIC_PRO_PRESET_ID}`;
	for (const key of ["editorToolbarButtons", "globalToolbarButtons"] as const) {
		if (raw?.[key] && !settings[key].some((b) => b.id === basicProButtonId)) {
			const basicIdx = settings[key].findIndex(
				(b) => b.id === basicPresetButtonId,
			);
			const insertIdx = basicIdx >= 0 ? basicIdx + 1 : 0;
			settings[key].splice(insertIdx, 0, {
				id: basicProButtonId,
				enabled: true,
			});
			needsSave = true;
		}
	}

	// Migrate GenerationPreset → flat language settings
	if ((raw as any)?.activeGenerationPresetId) {
		const presets = (raw as any)?.generationPresets ?? [];
		const active = presets.find(
			(p: any) => p.id === (raw as any).activeGenerationPresetId,
		);
		if (active) {
			settings.languageSource = active.sourceLanguage ?? "";
			settings.languageTarget = active.targetLanguage ?? "";
			settings.languageTtsField = active.ttsField ?? "";
			settings.languageTtsEnabled = active.ttsEnabled ?? false;
		}
		delete (settings as any).generationPresets;
		delete (settings as any).activeGenerationPresetId;
		needsSave = true;
	}

	// Generation preset migration
	if (!raw?.generationPresets) {
		const presets: GenerationPreset[] = [];
		const now = Date.now();

		// Migrate generationNoteTypeId → preset (if custom note type was configured)
		const genNoteTypeId = (raw as any)?.generationNoteTypeId;
		if (genNoteTypeId && genNoteTypeId !== "builtin-basic") {
			presets.push({
				id: `migrated-gen-${now}`,
				name: "Flashcards",
				noteTypeId: genNoteTypeId,
				fields: {},
				customPrompt: (raw as any)?.aiGenerationPrompt || undefined,
				tts: null,
				isPinned: true,
				isDefault: true,
				createdAt: now,
				updatedAt: now,
			});
		}

		// Fallback: built-in basic preset
		if (presets.length === 0) {
			presets.push({ ...BUILTIN_BASIC_PRESET });
		}

		const defaultPreset =
			presets.find((p) => p.isDefault) ?? presets[0] ?? BUILTIN_BASIC_PRESET;
		settings.generationPresets = presets;
		settings.defaultGenerationPresetId = defaultPreset.id;

		// Migrate legacy "flashcards" toolbar button ID → preset:* prefixed IDs
		for (const key of [
			"editorToolbarButtons",
			"globalToolbarButtons",
		] as const) {
			if (raw?.[key]) {
				const insertIdx = settings[key].findIndex(
					(b: any) => b.id === "flashcards",
				);
				const nonPresetButtons = settings[key].filter(
					(b: any) => b.id !== "flashcards",
				);
				const presetButtons = presets
					.filter((p) => p.isPinned)
					.map((p) => ({
						id: `preset:${p.id}`,
						enabled: true,
					}));
				nonPresetButtons.splice(Math.max(insertIdx, 0), 0, ...presetButtons);
				settings[key] = nonPresetButtons;
			}
		}

		needsSave = true;
	}

	// Backfill built-in Pro preset for existing installations
	if (
		settings.generationPresets &&
		!settings.generationPresets.some(
			(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
		)
	) {
		settings.generationPresets = [
			...settings.generationPresets,
			{ ...BUILTIN_BASIC_PRO_PRESET },
		];
		needsSave = true;
	}

	// Retrofit isPro on a pre-existing Pro preset that predates the flag
	if (settings.generationPresets) {
		for (const preset of settings.generationPresets) {
			if (preset.id === BUILTIN_BASIC_PRO_PRESET_ID && !preset.isPro) {
				preset.isPro = true;
				needsSave = true;
			}
		}
	}

	// Self-heal stale defaultGenerationPresetId that points to a missing preset.
	// Can happen via iCloud sync conflicts, external edits, or prior buggy deletes.
	if (settings.generationPresets && settings.generationPresets.length > 0) {
		const defaultExists = settings.generationPresets.some(
			(p) => p.id === settings.defaultGenerationPresetId,
		);
		if (!defaultExists) {
			const promoted =
				settings.generationPresets.find((p) => p.isDefault) ??
				settings.generationPresets.find(
					(p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID,
				) ??
				settings.generationPresets.find(
					(p) => p.id === BUILTIN_BASIC_PRESET.id,
				) ??
				settings.generationPresets[0];
			if (promoted) {
				settings.defaultGenerationPresetId = promoted.id;
				for (const preset of settings.generationPresets) {
					preset.isDefault = preset.id === promoted.id;
				}
				needsSave = true;
			}
		}
	}

	return { settings, needsSave };
}
