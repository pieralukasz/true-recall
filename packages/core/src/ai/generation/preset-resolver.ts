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
