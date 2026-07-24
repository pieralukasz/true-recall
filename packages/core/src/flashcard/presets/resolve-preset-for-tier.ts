import {
	BUILTIN_BASIC_PRESET_ID,
	BUILTIN_BASIC_PRO_PRESET_ID,
} from "../../constants";
import type { GenerationPreset } from "../../types/generation-preset.types";

/**
 * Resolves the preset a generation action should actually run with.
 *
 * The toolbar shows a single "Basic Flashcards" action; Pro users get the
 * Pro prompt under the hood instead of a second, near-identical button.
 * Explicitly requested presets (custom or the Pro id itself) pass through.
 */
export function resolveGenerationPresetForTier(
	presets: readonly GenerationPreset[],
	presetId: string,
	hasPro: boolean,
): GenerationPreset | null {
	const requested = presets.find((p) => p.id === presetId) ?? null;
	if (!requested) return null;
	if (requested.id !== BUILTIN_BASIC_PRESET_ID || !hasPro) return requested;
	return presets.find((p) => p.id === BUILTIN_BASIC_PRO_PRESET_ID) ?? requested;
}
