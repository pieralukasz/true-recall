import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRESET_ID,
	BUILTIN_BASIC_PRO_PRESET,
	BUILTIN_BASIC_PRO_PRESET_ID,
	DEFAULT_SETTINGS,
} from "../constants";
import type { GenerationPreset } from "../types/generation-preset.types";
import type { AITier, TrueRecallSettings } from "../types/settings.types";
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

	return {
		id: p.id,
		name: p.name,
		prompt,
		noteTypeId: p.noteTypeId,
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

	// Derive providerType if not set or invalid
	if (
		settings.providerType !== "pro" &&
		settings.providerType !== "openrouter" &&
		settings.providerType !== "custom" &&
		settings.providerType !== "lmstudio"
	) {
		if (settings.proKey) {
			settings.providerType = "pro";
		} else if (settings.openRouterApiKey) {
			settings.providerType = "openrouter";
		} else {
			settings.providerType = "openrouter";
		}
		needsSave = true;
	}

	// Derive providerType from available keys when providerType was not in raw data
	if (!raw?.providerType) {
		if (settings.proKey && settings.providerType !== "pro") {
			settings.providerType = "pro";
			needsSave = true;
		} else if (
			settings.openRouterApiKey &&
			settings.providerType === "openrouter"
		) {
			// openrouter is the default — if they have a key, keep it
		}
	}

	// Sync aiTier with providerType
	const derivedTier: AITier =
		settings.providerType === "pro"
			? "pro"
			: settings.providerType === "custom"
				? "custom"
				: settings.providerType === "lmstudio"
					? "lmstudio"
					: "byok";
	if (settings.aiTier !== derivedTier) {
		(settings as { aiTier: AITier }).aiTier = derivedTier;
		needsSave = true;
	}

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
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- load-bearing: raw's static type (Partial<TrueRecallSettings>) no longer has this property at all, since it's only ever present in stale on-disk data written by old versions
		(raw as Record<string, unknown> | null)?.flashcardGeneration !== undefined
	) {
		delete (settings as { flashcardGeneration?: unknown }).flashcardGeneration;
		needsSave = true;
	}

	// easyDays: array → object migration
	if (Array.isArray(settings.easyDays)) {
		settings.easyDays = {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- load-bearing: settings.easyDays is narrowed to `unknown[]` by the Array.isArray check above, and TS won't let one assertion bridge unknown[] -> number[] without the unknown hop
			recurringDays: settings.easyDays as unknown as number[],
			specificDates: [],
		};
	}

	// Backfill new preset fields for existing presets
	if (settings.fsrsPresets) {
		for (const preset of settings.fsrsPresets) {
			if (preset.leechThreshold === undefined) {
				preset.leechThreshold = 8;
				needsSave = true;
			}
			if (preset.leechAction === undefined) {
				preset.leechAction = "tag-only";
				needsSave = true;
			}
			if (preset.enableFuzz === undefined) {
				preset.enableFuzz = true;
				needsSave = true;
			}
			if (preset.newCardOrder === undefined) {
				preset.newCardOrder = settings.newCardOrder;
				needsSave = true;
			}
			if (preset.reviewOrder === undefined) {
				preset.reviewOrder = settings.reviewOrder;
				needsSave = true;
			}
			if (preset.newReviewMix === undefined) {
				preset.newReviewMix = settings.newReviewMix;
				needsSave = true;
			}
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
				enableFuzz: true,
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

	// Collapse the builtin basic/Pro toolbar button pair into a single button.
	// Earlier migrations injected the Pro twin next to the basic one; the
	// toolbar now shows one "Basic Flashcards" action and resolves the Pro
	// prompt at click time for Pro users.
	const basicPresetButtonId = `preset:${BUILTIN_BASIC_PRESET_ID}`;
	const basicProButtonId = `preset:${BUILTIN_BASIC_PRO_PRESET_ID}`;
	for (const key of ["editorToolbarButtons", "globalToolbarButtons"] as const) {
		if (!settings[key].some((b) => b.id === basicProButtonId)) continue;
		const hasBasic = settings[key].some((b) => b.id === basicPresetButtonId);
		settings[key] = hasBasic
			? settings[key].filter((b) => b.id !== basicProButtonId)
			: settings[key].map((b) =>
					b.id === basicProButtonId
						? { id: basicPresetButtonId, enabled: b.enabled }
						: b,
				);
		needsSave = true;
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
			}>;
		};
		const presets = legacy.generationPresets ?? [];
		const active = presets.find(
			(p) => p.id === legacy.activeGenerationPresetId,
		);
		if (active) {
			settings.languageSource = active.sourceLanguage ?? "";
			settings.languageTarget = active.targetLanguage ?? "";
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
		const builtinPrompts: Record<string, string> = {
			[BUILTIN_BASIC_PRESET_ID]: BUILTIN_BASIC_PRESET.prompt,
			[BUILTIN_BASIC_PRO_PRESET_ID]: BUILTIN_BASIC_PRO_PRESET.prompt,
		};
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
			// Builtin prompts are not user-editable, so persisted copies are safe
			// to refresh — otherwise installs keep whatever text they were first
			// seeded with and never receive prompt improvements.
			const currentPrompt = builtinPrompts[preset.id];
			if (currentPrompt !== undefined && preset.prompt !== currentPrompt) {
				preset.prompt = currentPrompt;
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

	// Backfill the ask-ai toolbar button for users with saved button arrays
	for (const key of ["editorToolbarButtons", "globalToolbarButtons"] as const) {
		const buttons = settings[key];
		if (Array.isArray(buttons) && !buttons.some((b) => b.id === "ask-ai")) {
			buttons.push({ id: "ask-ai", enabled: true });
			needsSave = true;
		}
	}

	return { settings, needsSave };
}
