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

	if (preset.tts?.field && !noteType.fields.includes(preset.tts.field)) {
		throw new Error(
			`Preset "${preset.id}" has TTS configured for field "${preset.tts.field}" which is not in note type "${noteType.id}"`,
		);
	}

	if (preset.image) {
		if (!noteType.fields.includes(preset.image.targetField)) {
			throw new Error(
				`Preset "${preset.id}" has image targetField "${preset.image.targetField}" which is not in note type "${noteType.id}"`,
			);
		}
		if (!noteType.fields.includes(preset.image.sourceField)) {
			throw new Error(
				`Preset "${preset.id}" has image sourceField "${preset.image.sourceField}" which is not in note type "${noteType.id}"`,
			);
		}
	}

	return { preset, noteType };
}
