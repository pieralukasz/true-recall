import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
export declare function buildPresetPrompt(preset: GenerationPreset, noteType: NoteType): string;
export declare function buildPresetFormatSpec(preset: GenerationPreset, noteType: NoteType): string;
export declare function buildCardFormatSpec(noteType: NoteType): string;
export declare function buildByokPrompt(noteType: NoteType, languageCode: string, customPrompt?: string): string;
