import { signal } from "@preact/signals";
import type { FlashcardItem } from "@shared/types";

export interface StreamingGenerationState {
	isGenerating: boolean;
	noteName: string | null;
	notePath: string | null;
	completedCards: FlashcardItem[];
	partialQuestion: string | null;
	partialAnswer: string | null;
	error: string | null;
	abortController: AbortController | null;
}

const INITIAL_STATE: StreamingGenerationState = {
	isGenerating: false,
	noteName: null,
	notePath: null,
	completedCards: [],
	partialQuestion: null,
	partialAnswer: null,
	error: null,
	abortController: null,
};

export const streamingGeneration =
	signal<StreamingGenerationState>(INITIAL_STATE);

export function startStreaming(
	noteName: string,
	notePath: string | null,
	abortController: AbortController,
): void {
	streamingGeneration.value = {
		...INITIAL_STATE,
		isGenerating: true,
		noteName,
		notePath,
		abortController,
	};
}

export function addStreamedCard(card: FlashcardItem): void {
	const current = streamingGeneration.value;
	streamingGeneration.value = {
		...current,
		completedCards: [...current.completedCards, card],
		partialQuestion: null,
		partialAnswer: null,
	};
}

export function updatePartial(
	question: string | null,
	answer: string | null,
): void {
	const current = streamingGeneration.value;
	streamingGeneration.value = {
		...current,
		partialQuestion: question,
		partialAnswer: answer,
	};
}

export function finishStreaming(error?: string): void {
	streamingGeneration.value = {
		...INITIAL_STATE,
		error: error ?? null,
	};
}

export function cancelStreaming(): void {
	const current = streamingGeneration.value;
	current.abortController?.abort();
	streamingGeneration.value = { ...INITIAL_STATE };
}
