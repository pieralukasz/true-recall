import { batch, type ReadonlySignal, signal } from "@preact/signals";
import { refreshCards } from "@shared/services/reactive-card-store";
import type { HighlightColor } from "@shared/ui/helpers/fsrs-colors";

// ── Card mutation events ────────────────────────────────────

export interface CardMutation {
	type: "added" | "updated" | "removed" | "reviewed" | "bulk";
	cardId?: string;
	cardIds?: string[];
	changes?: {
		question?: boolean;
		answer?: boolean;
		fsrs?: boolean;
		suspended?: boolean;
		buried?: boolean;
		sourceUid?: boolean;
	};
	action?: string;
	sourceNoteName?: string;
	rating?: number;
	newState?: number;
}

const _lastMutation = signal<CardMutation | null>(null);
export const lastMutation: ReadonlySignal<CardMutation | null> = _lastMutation;

export function notifyCardChange(mutation: CardMutation): void {
	batch(() => {
		_lastMutation.value = mutation;
		refreshCards();
	});
}

// ── Source text highlight (Card → Text jump) ────────────────

export type { HighlightColor } from "@shared/ui/helpers/fsrs-colors";

export interface HighlightRequest {
	sourceNotePath: string;
	sourceText: string;
	requestId: number;
	mode: "jump" | "hover";
	colorHint?: HighlightColor;
}

const _highlightRequest = signal<HighlightRequest | null>(null);
export const highlightRequest: ReadonlySignal<HighlightRequest | null> =
	_highlightRequest;

let highlightCounter = 0;

export function requestSourceHighlight(
	sourceNotePath: string,
	sourceText: string,
	mode: "jump" | "hover" = "jump",
	colorHint?: HighlightColor,
): void {
	_highlightRequest.value = {
		sourceNotePath,
		sourceText,
		requestId: ++highlightCounter,
		mode,
		colorHint,
	};
}

export function clearSourceHighlight(): void {
	_highlightRequest.value = null;
}
