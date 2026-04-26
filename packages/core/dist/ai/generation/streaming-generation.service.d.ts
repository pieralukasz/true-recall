import type { IHttpClient } from "../../interfaces/http-client";
import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { type ExistingCardContext } from "../prompts/existing-cards-block";
import { type ScheduleCallback } from "../state/streaming-state";
import { type CardEventFlashcardManager, type SourceFileRef } from "./process-card-events";
export declare const FALLBACK_BASIC_NOTE_TYPE: NoteType;
export interface StreamingGenerationResult {
    created: number;
    duplicates: number;
    createdCardIds: string[];
    preset: GenerationPreset;
}
/** Minimal file reference for streaming generation (replaces Obsidian TFile). */
export interface StreamingSourceFile extends SourceFileRef {
    basename: string;
}
/** Minimal FlashcardManager interface for streaming generation. */
export interface StreamingFlashcardManager extends CardEventFlashcardManager {
    getNoteTypeBySlug?(slug: string): NoteType | null;
    getNoteTypeById(id: string): NoteType | null;
}
export interface StreamingGenerationOptions {
    existingCards?: ExistingCardContext[];
}
export declare class StreamingGenerationService {
    private getSettings;
    private flashcardManager;
    private httpClient;
    private schedule?;
    constructor(getSettings: () => TrueRecallSettings, flashcardManager: StreamingFlashcardManager, httpClient: IHttpClient, schedule?: ScheduleCallback | undefined);
    generate(text: string, sourceFile: StreamingSourceFile, presetId: string, options?: StreamingGenerationOptions): Promise<StreamingGenerationResult>;
    private runPresetGeneration;
}
