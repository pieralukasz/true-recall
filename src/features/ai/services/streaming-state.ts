import { signal } from "@preact/signals";
import type { FlashcardItem } from "@shared/types";

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

const INITIAL_STATE: StreamingGenerationState = {
	isGenerating: false,
	phase: "idle",
	noteName: null,
	notePath: null,
	completedCards: [],
	recentCardIds: new Set<string>(),
	partialQuestion: null,
	partialAnswer: null,
	error: null,
	abortController: null,
	totalChunks: null,
	completedChunks: 0,
	currentChunkLabel: null,
};

export const streamingGeneration =
	signal<StreamingGenerationState>(INITIAL_STATE);

export function startStreaming(
	noteName: string,
	notePath: string | null,
	abortController: AbortController,
	totalChunks?: number,
): void {
	streamingGeneration.value = {
		...INITIAL_STATE,
		isGenerating: true,
		phase: "waiting",
		noteName,
		notePath,
		abortController,
		totalChunks: totalChunks ?? null,
	};
}

export function addStreamedCard(card: FlashcardItem): void {
	const current = streamingGeneration.value;
	const newRecentIds = new Set(current.recentCardIds);
	newRecentIds.add(card.id);
	streamingGeneration.value = {
		...current,
		completedCards: [...current.completedCards, card],
		recentCardIds: newRecentIds,
		// Keep partialQuestion/partialAnswer — acts as visual bridge until next updatePartial() replaces them
	};
}

export function updatePartial(
	question: string | null,
	answer: string | null,
): void {
	const current = streamingGeneration.value;
	streamingGeneration.value = {
		...current,
		phase: current.phase === "waiting" ? "streaming" : current.phase,
		partialQuestion: question,
		partialAnswer: answer,
	};
}

export function updateChunkProgress(
	completedChunks: number,
	currentChunkLabel: string | null,
): void {
	const current = streamingGeneration.value;
	streamingGeneration.value = {
		...current,
		completedChunks,
		currentChunkLabel,
	};
}

export function finishStreaming(error?: string): void {
	const current = streamingGeneration.value;
	streamingGeneration.value = {
		...INITIAL_STATE,
		recentCardIds: current.recentCardIds,
		error: error ?? null,
	};
}

export function clearRecentCards(): void {
	streamingGeneration.value = {
		...streamingGeneration.value,
		recentCardIds: new Set<string>(),
	};
}

export function cancelStreaming(): void {
	const current = streamingGeneration.value;
	current.abortController?.abort();
	streamingGeneration.value = { ...INITIAL_STATE };
}
