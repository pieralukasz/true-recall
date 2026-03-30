import type { IHttpClient } from "../../interfaces/http-client";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { type ScheduleCallback } from "../state/streaming-state";
import { type StreamingGenerationResult, type StreamingFlashcardManager, type StreamingSourceFile } from "./streaming-generation.service";
export interface ChunkedGenerationResult extends StreamingGenerationResult {
    failedChunks: number;
    totalChunks: number;
    errors: string[];
}
/**
 * Platform-injectable confirmation dialog.
 * In Obsidian, wire this to the ConfirmModal.
 * Return `true` to proceed, `false` to cancel.
 */
export type ConfirmLargeNote = (params: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
}) => Promise<boolean>;
export declare class ChunkedGenerationService {
    private getSettings;
    private flashcardManager;
    private httpClient;
    private schedule?;
    constructor(getSettings: () => TrueRecallSettings, flashcardManager: StreamingFlashcardManager, httpClient: IHttpClient, schedule?: ScheduleCallback | undefined);
    generateFromNote(content: string, sourceFile: StreamingSourceFile, noteType?: NoteType | null, confirmLargeNote?: ConfirmLargeNote): Promise<ChunkedGenerationResult>;
    private runChunkedGeneration;
    private generateSingleChunk;
}
