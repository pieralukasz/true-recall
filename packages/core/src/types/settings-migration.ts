import type {
	CardAIPreset,
	CardAIUserSettings,
} from "../ai/card-ai/card-ai.types";

interface LegacyBucket {
	presets?: CardAIPreset[];
	userPresets?: CardAIPreset[];
	customPromptAutoApply?: boolean;
}

/**
 * Renames legacy `cardPolish.presets` → `cardPolish.userPresets` and drops any
 * entries with `builtin: true`. Built-ins now live in plugin code, never in
 * settings. Idempotent. No-op when `cardPolish` is absent.
 */
export function migrateCardPolishSettings<T extends Record<string, unknown>>(
	settings: T,
): T {
	const legacy = settings.cardPolish as LegacyBucket | undefined;
	if (!legacy) return settings;
	if (Array.isArray(legacy.userPresets) && !("presets" in legacy))
		return settings;

	const next = { ...settings } as Record<string, unknown>;
	const source = legacy.presets ?? legacy.userPresets ?? [];
	const migrated: CardAIUserSettings = {
		userPresets: source.filter((p) => !p.builtin),
		customPromptAutoApply: legacy.customPromptAutoApply ?? false,
	};
	next.cardPolish = migrated;
	return next as T;
}
