import type { FlashcardItem } from "../../types/flashcard.types";
export type StreamingPhase = "idle" | "waiting" | "streaming";
export interface StreamingGenerationState {
    isGenerating: boolean;
    phase: StreamingPhase;
    noteName: string | null;
    notePath: string | null;
    completedCards: FlashcardItem[];
    recentCardIds: Set<string>;
    partialQuestion: string | null;
    partialAnswer: string | null;
    error: string | null;
    abortController: AbortController | null;
    totalChunks: number | null;
    completedChunks: number;
    currentChunkLabel: string | null;
}
export type StateListener = (state: StreamingGenerationState) => void;
/** Simple observable state container (platform-agnostic replacement for @preact/signals). */
declare class StreamingStateStore {
    private _value;
    private listeners;
    get value(): StreamingGenerationState;
    set value(newState: StreamingGenerationState);
    subscribe(listener: StateListener): () => void;
}
export declare const streamingGeneration: StreamingStateStore;
export declare function startStreaming(noteName: string, notePath: string | null, abortController: AbortController, totalChunks?: number): void;
export declare function addStreamedCard(card: FlashcardItem): void;
export declare function updatePartial(question: string | null, answer: string | null): void;
export declare function updateChunkProgress(completedChunks: number, currentChunkLabel: string | null): void;
export declare function finishStreaming(error?: string): void;
export declare function clearRecentCards(): void;
export declare function cancelStreaming(): void;
/**
 * Platform-injectable scheduler for throttling partial updates.
 * In the browser/Obsidian, pass `requestAnimationFrame`.
 * In Node/test environments, pass `(cb) => setTimeout(cb, 16)` or similar.
 */
export type ScheduleCallback = (cb: () => void) => void;
export declare function createThrottledPartialUpdater(schedule?: ScheduleCallback): (question: string | null, answer: string | null) => void;
export {};
