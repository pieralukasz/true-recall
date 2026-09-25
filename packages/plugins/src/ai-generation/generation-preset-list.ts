import type { GenerationPreset } from "@true-recall/core";

/**
 * Keep exactly one default preset. The first preset flagged `isDefault` wins;
 * with none flagged, the first preset becomes the default.
 */
export function normalizeGenerationPresets(
	presets: readonly GenerationPreset[],
): GenerationPreset[] {
	const preferredDefault =
		presets.find((preset) => preset.isDefault)?.id ?? presets[0]?.id ?? null;

	return presets.map((preset) => ({
		...preset,
		isDefault: preferredDefault
			? preset.id === preferredDefault
			: !!preset.isDefault,
	}));
}

/**
 * Apply an edit from the settings editor to one user preset.
 *
 * Marking a preset as default unmarks every other preset, like
 * `GenerationPresetService.update`. Without that, normalization keeps the
 * first flagged preset (a built-in) and the new default is lost on save.
 */
export function applyUserPresetPatch(
	presets: readonly GenerationPreset[],
	id: string,
	patch: Partial<GenerationPreset>,
	now: number = Date.now(),
): GenerationPreset[] {
	const target = presets.find((preset) => preset.id === id && !preset.builtin);
	if (!target) return presets.slice();

	const makesDefault = patch.isDefault === true;
	return presets.map((existing) => {
		if (existing === target) {
			return { ...existing, ...patch, updatedAt: now };
		}
		return makesDefault && existing.isDefault
			? { ...existing, isDefault: false }
			: existing;
	});
}

/** A preset needs a prompt: the service, API, CLI and MCP reject one without it. */
export function isGenerationPromptMissing(preset: GenerationPreset): boolean {
	return preset.prompt.trim().length === 0;
}

/**
 * The settings panel saves the preset list only while every user preset has
 * a prompt, so an empty prompt never reaches settings.
 */
export function canSaveGenerationPresets(
	presets: readonly GenerationPreset[],
): boolean {
	return presets.every(
		(preset) => preset.builtin || !isGenerationPromptMissing(preset),
	);
}
