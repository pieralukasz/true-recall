import { batch, type ReadonlySignal, signal } from "@preact/signals";

export function track(...signals: ReadonlySignal[]): void {
	for (const s of signals) s.value;
}

export const dataVersion = signal(0);

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

export const lastMutation = signal<CardMutation | null>(null);

export const settingsVersion = signal(0);
export const syncVersion = signal(0);

export function notifyCardChange(mutation: CardMutation): void {
	batch(() => {
		lastMutation.value = mutation;
		dataVersion.value++;
	});
}

// ── Source text highlight (Card → Text jump) ──────────────────

export interface HighlightRequest {
	sourceNotePath: string;
	sourceText: string;
	requestId: number;
	mode: "jump" | "hover";
}

export const highlightRequest = signal<HighlightRequest | null>(null);

let highlightCounter = 0;

export function requestSourceHighlight(
	sourceNotePath: string,
	sourceText: string,
	mode: "jump" | "hover" = "jump",
): void {
	highlightRequest.value = {
		sourceNotePath,
		sourceText,
		requestId: ++highlightCounter,
		mode,
	};
}

export function clearSourceHighlight(): void {
	highlightRequest.value = null;
}
