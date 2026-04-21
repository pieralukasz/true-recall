import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRESET_ID,
	BUILTIN_BASIC_PRO_PRESET,
	BUILTIN_BASIC_PRO_PRESET_ID,
	DEFAULT_SETTINGS,
} from "../constants";
import type {
	GenerationPreset,
	PresetImageConfig,
	PresetTTSConfig,
} from "../types/generation-preset.types";
import type { TrueRecallSettings } from "../types/settings.types";
import { migrateCardPolishSettings } from "../types/settings-migration";

interface LegacyGenerationPreset {
	id: string;
	name: string;
	noteTypeId: string;
	fields?: Record<
		string,
		| { role: "ai-text"; instruction: string }
		| { role: "image"; sourceField: string; style?: string }
		| { role: "manual" }
	>;
	prompt?: string;
	customPrompt?: string;
	tts?: { field: string; voice: string; autoplay?: boolean } | null;
	image?: { targetField: string; sourceField: string; style?: string } | null;
	isPinned?: boolean;
	isDefault?: boolean;
	isPro?: boolean;
	requiresPro?: boolean;
	builtin?: boolean;
	createdAt?: number;
	updatedAt?: number;
}

function isLegacyShape(p: LegacyGenerationPreset): boolean {
	return p.prompt === undefined || p.fields !== undefined;
}

function migrateLegacyPreset(p: LegacyGenerationPreset): GenerationPreset {
	const fieldInstructions = p.fields
		? Object.entries(p.fields)
				.filter(([, cfg]) => cfg.role === "ai-text")
				.map(
					([name, cfg]) =>
						`- "${name}": ${(cfg as { instruction: string }).instruction}`,
				)
				.join("\n")
		: "";
	const prompt =
		p.prompt?.trim() ||
		[p.customPrompt?.trim(), fieldInstructions.trim()]
			.filter(Boolean)
			.join("\n\n") ||
		"Generate flashcards from the provided text.";

	const imageEntry = p.fields
		? Object.entries(p.fields).find(([, cfg]) => cfg.role === "image")
		: undefined;
	const image: PresetImageConfig | null = p.image
		? p.image
		: imageEntry
			? {
					targetField: imageEntry[0],
					sourceField: (imageEntry[1] as { sourceField: string }).sourceField,
					style: (imageEntry[1] as { style?: string }).style,
				}
			: null;

	const tts: PresetTTSConfig | null = p.tts
		? {
				field: p.tts.field,
				voice: p.tts.voice,
				autoplay: p.tts.autoplay ?? false,
			}
		: null;

	return {
		id: p.id,
		name: p.name,
		prompt,
		noteTypeId: p.noteTypeId,
		tts,
		image,
		requiresPro: p.requiresPro ?? p.isPro ?? false,
		builtin:
			p.builtin ??
			(p.id === BUILTIN_BASIC_PRESET_ID ||
				p.id === BUILTIN_BASIC_PRO_PRESET_ID),
		isDefault: p.isDefault ?? false,
		createdAt: p.createdAt ?? Date.now(),
		updatedAt: p.updatedAt ?? Date.now(),
	};
}

/**
 * Merge raw persisted data with defaults and run all migrations.
 * Pure function — no side effects.
 */
export function migrateSettings(raw: Partial<TrueRecallSettings> | null): {
	settings: TrueRecallSettings;
	needsSave: boolean;
} {
	const migratedRaw = raw
		? (migrateCardPolishSettings(
				raw as Record<string, unknown>,
			) as Partial<TrueRecallSettings>)
		: raw;
	const settings: TrueRecallSettings = { ...DEFAULT_SETTINGS, ...migratedRaw };
	let needsSave = false;

	// cardPolish bucket migration: drop legacy built-ins and rename presets → userPresets
	const legacyPolish = (raw as { cardPolish?: { presets?: unknown } } | null)
		?.cardPolish;
	if (legacyPolish && "presets" in legacyPolish) {
		needsSave = true;
	}

	// flashcardGeneration bucket is deprecated — presets now live in
	// settings.generationPresets. Drop the bucket so stale data does not
	// persist across saves.
	if (
		(raw as Record<string, unknown> | null)?.flashcardGeneration !== undefined
	) {
		delete (settings as { flashcardGeneration?: unknown }).flashcardGeneration;
		needsSave = true;
	}

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
	const basicPresetButtonId = `preset:${BUILTIN_BASIC_PRESET_ID}`;
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

	// Migrate old activeGenerationPresetId → flat language settings
	if (
		(raw as { activeGenerationPresetId?: unknown })?.activeGenerationPresetId
	) {
		const legacy = raw as {
			activeGenerationPresetId?: string;
			generationPresets?: Array<{
				id: string;
				sourceLanguage?: string;
				targetLanguage?: string;
				ttsField?: string;
				ttsEnabled?: boolean;
			}>;
		};
		const presets = legacy.generationPresets ?? [];
		const active = presets.find(
			(p) => p.id === legacy.activeGenerationPresetId,
		);
		if (active) {
			settings.languageSource = active.sourceLanguage ?? "";
			settings.languageTarget = active.targetLanguage ?? "";
			settings.languageTtsField = active.ttsField ?? "";
			settings.languageTtsEnabled = active.ttsEnabled ?? false;
		}
		delete (settings as { generationPresets?: unknown }).generationPresets;
		delete (settings as { activeGenerationPresetId?: unknown })
			.activeGenerationPresetId;
		needsSave = true;
	}

	// Generation preset migration
	if (!raw?.generationPresets) {
		const presets: GenerationPreset[] = [];
		const now = Date.now();

		// Migrate generationNoteTypeId → preset (if custom note type was configured)
		const legacyRaw = raw as {
			generationNoteTypeId?: string;
			aiGenerationPrompt?: string;
		} | null;
		const genNoteTypeId = legacyRaw?.generationNoteTypeId;
		if (genNoteTypeId && genNoteTypeId !== "builtin-basic") {
			presets.push({
				id: `migrated-gen-${now}`,
				name: "Flashcards",
				prompt:
					legacyRaw?.aiGenerationPrompt ??
					"Generate flashcards from the provided text.",
				noteTypeId: genNoteTypeId,
				tts: null,
				image: null,
				requiresPro: false,
				builtin: false,
				isDefault: true,
				createdAt: now,
				updatedAt: now,
			});
		}

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
				const insertIdx = settings[key].findIndex((b) => b.id === "flashcards");
				const nonPresetButtons = settings[key].filter(
					(b) => b.id !== "flashcards",
				);
				const presetButtons = presets.map((p) => ({
					id: `preset:${p.id}`,
					enabled: true,
				}));
				nonPresetButtons.splice(Math.max(insertIdx, 0), 0, ...presetButtons);
				settings[key] = nonPresetButtons;
			}
		}

		needsSave = true;
	} else {
		// Migrate persisted presets to flat shape when any are in legacy form.
		const rawPresets =
			raw.generationPresets as unknown as LegacyGenerationPreset[];
		if (rawPresets.some(isLegacyShape)) {
			settings.generationPresets = rawPresets.map(migrateLegacyPreset);
			needsSave = true;
		}
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

	// Retrofit builtin/requiresPro flags on seeded built-ins from pre-migration installs
	if (settings.generationPresets) {
		for (const preset of settings.generationPresets) {
			if (
				(preset.id === BUILTIN_BASIC_PRO_PRESET_ID ||
					preset.id === BUILTIN_BASIC_PRESET_ID) &&
				!preset.builtin
			) {
				preset.builtin = true;
				needsSave = true;
			}
			if (preset.id === BUILTIN_BASIC_PRO_PRESET_ID && !preset.requiresPro) {
				preset.requiresPro = true;
				needsSave = true;
			}
		}
	}

	// Self-heal stale defaultGenerationPresetId that points to a missing preset.
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
