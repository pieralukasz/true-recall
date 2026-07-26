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

export type StateListener = (state: StreamingGenerationState) => void;

/** Simple observable state container (platform-agnostic replacement for @preact/signals). */
class StreamingStateStore {
	private _value: StreamingGenerationState = {
		...INITIAL_STATE,
		recentCardIds: new Set<string>(),
	};
	private listeners: Set<StateListener> = new Set();

	get value(): StreamingGenerationState {
		return this._value;
	}

	set value(newState: StreamingGenerationState) {
		this._value = newState;
		for (const listener of this.listeners) {
			listener(newState);
		}
	}

	subscribe(listener: StateListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

export const streamingGeneration = new StreamingStateStore();

export function startStreaming(
	noteName: string,
	notePath: string | null,
	abortController: AbortController,
	totalChunks?: number,
): void {
	streamingGeneration.value = {
		...INITIAL_STATE,
		recentCardIds: new Set<string>(),
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
	streamingGeneration.value = {
		...INITIAL_STATE,
		recentCardIds: new Set<string>(),
	};
}

/**
 * Platform-injectable scheduler for throttling partial updates.
 * In the browser/Obsidian, pass `requestAnimationFrame`.
 * In Node/test environments, pass `(cb) => setTimeout(cb, 16)` or similar.
 */
export type ScheduleCallback = (cb: () => void) => void;

/**
 * Default scheduler: uses requestAnimationFrame if available, else setTimeout.
 */
const defaultSchedule: ScheduleCallback =
	typeof requestAnimationFrame !== "undefined"
		? (cb) => window.requestAnimationFrame(cb)
		: (cb) => window.setTimeout(cb, 16);

export function createThrottledPartialUpdater(
	schedule: ScheduleCallback = defaultSchedule,
): (question: string | null, answer: string | null) => void {
	let pendingQuestion: string | null = null;
	let pendingAnswer: string | null = null;
	let scheduled = false;

	return (question, answer) => {
		pendingQuestion = question;
		pendingAnswer = answer;
		if (!scheduled) {
			scheduled = true;
			schedule(() => {
				updatePartial(pendingQuestion, pendingAnswer);
				scheduled = false;
			});
		}
	};
}
