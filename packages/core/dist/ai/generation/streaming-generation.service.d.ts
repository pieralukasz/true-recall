import type { IHttpClient } from "../../interfaces/http-client";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { type ScheduleCallback } from "../state/streaming-state";
import { type CardEventFlashcardManager, type SourceFileRef } from "./process-card-events";
export declare const FALLBACK_BASIC_NOTE_TYPE: NoteType;
export declare function buildGenerationPrompt(settings: TrueRecallSettings, noteType?: NoteType | null): string;
export interface StreamingGenerationResult {
    created: number;
    duplicates: number;
}
/** Minimal file reference for streaming generation (replaces Obsidian TFile). */
export interface StreamingSourceFile extends SourceFileRef {
    basename: string;
}
/** Minimal FlashcardManager interface for streaming generation. */
export interface StreamingFlashcardManager extends CardEventFlashcardManager {
    getNoteTypeBySlug?(slug: string): NoteType | null;
}
export declare class StreamingGenerationService {
    private getSettings;
    private flashcardManager;
    private httpClient;
    private schedule?;
    constructor(getSettings: () => TrueRecallSettings, flashcardManager: StreamingFlashcardManager, httpClient: IHttpClient, schedule?: ScheduleCallback | undefined);
    generateStreaming(text: string, sourceFile: StreamingSourceFile, noteType?: NoteType | null): Promise<StreamingGenerationResult>;
    private runStreamingGeneration;
}
