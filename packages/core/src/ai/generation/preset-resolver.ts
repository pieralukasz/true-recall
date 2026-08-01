import { resolveGenerationPresetForTier } from "../../flashcard/presets/resolve-preset-for-tier";
import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";

export interface PresetResolverFlashcardManager {
	getNoteTypeById(id: string): NoteType | null;
}

export interface ResolvedGenerationPreset {
	preset: GenerationPreset;
	noteType: NoteType;
}

export function resolveGenerationPresetAndNoteType(
	settings: TrueRecallSettings,
	flashcardManager: PresetResolverFlashcardManager,
	presetId: string,
): ResolvedGenerationPreset {
	const preset = (settings.generationPresets ?? []).find(
		(p) => p.id === presetId,
	);
	if (!preset) {
		throw new Error(`Generation preset "${presetId}" not found`);
	}

	const noteType = flashcardManager.getNoteTypeById(preset.noteTypeId);
	if (!noteType) {
		throw new Error(
			`Preset "${preset.id}" references unknown note type "${preset.noteTypeId}"`,
		);
	}

	return { preset, noteType };
}

/**
 * The one way a preset id becomes a runnable (preset, noteType) pair.
 *
 * Folds together the three checks that used to live in separate places: the
 * tier swap (Pro users silently get the Pro prompt behind the plain Basic
 * action), the note-type lookup, and the Pro entitlement gate. Every entry
 * point resolves here so the panel, the toolbar, and the API cannot drift into
 * running different presets for the same request.
 */
export function resolveGenerationTarget(
	settings: TrueRecallSettings,
	flashcardManager: PresetResolverFlashcardManager,
	presetId: string,
): ResolvedGenerationPreset {
	const tierPreset = resolveGenerationPresetForTier(
		settings.generationPresets ?? [],
		presetId,
		!!settings.proKey,
	);
	if (!tierPreset) {
		throw new Error(`Generation preset "${presetId}" not found`);
	}

	const { preset, noteType } = resolveGenerationPresetAndNoteType(
		settings,
		flashcardManager,
		tierPreset.id,
	);

	if (preset.requiresPro && !settings.proKey) {
		throw new Error(
			`Preset "${preset.name}" requires True Recall Pro. Upgrade or pick a different preset.`,
		);
	}

	return { preset, noteType };
}
