import type { IHttpClient } from "../../interfaces/http-client";
import type { TrueRecallSettings } from "../../types/settings.types";
import { type ExistingCardContext } from "../prompts/existing-cards-block";
import { type ScheduleCallback } from "../state/streaming-state";
import { type StreamingFlashcardManager, type StreamingGenerationResult, type StreamingSourceFile } from "./streaming-generation.service";
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
    generateFromNote(content: string, sourceFile: StreamingSourceFile, presetId: string, options?: {
        existingCards?: ExistingCardContext[];
    }, confirmLargeNote?: ConfirmLargeNote): Promise<ChunkedGenerationResult>;
    private runChunkedGeneration;
    private generateSingleChunk;
}
