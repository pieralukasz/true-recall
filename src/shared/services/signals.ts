import { batch, type ReadonlySignal, signal } from "@preact/signals";
import { refreshCards } from "@shared/services/reactive-card-store";
import type { HighlightColor } from "@shared/ui/helpers/fsrs-colors";

export function track(...signals: ReadonlySignal[]): void {
	for (const s of signals) s.value;
}

/**
 * Reads numeric signal values during render, triggering Preact's auto-subscription.
 * Returns their sum for use as a useMemo/useCallback dependency.
 *
 * Replaces the useState(0) + useEffect + effect() + track() workaround.
 */
export function useSignalVersion(
	...signals: ReadonlySignal<number>[]
): number {
	let sum = 0;
	for (const s of signals) sum += s.value;
	return sum;
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
export const metadataVersion = signal(0);

export function notifyCardChange(mutation: CardMutation): void {
	batch(() => {
		lastMutation.value = mutation;
		refreshCards();
		dataVersion.value++; // TODO: remove after all consumers migrated to reactive store
	});
}

// ── Source text highlight (Card → Text jump) ──────────────────

export type { HighlightColor } from "@shared/ui/helpers/fsrs-colors";

export interface HighlightRequest {
	sourceNotePath: string;
	sourceText: string;
	requestId: number;
	mode: "jump" | "hover";
	colorHint?: HighlightColor;
}

export const highlightRequest = signal<HighlightRequest | null>(null);

let highlightCounter = 0;

export function requestSourceHighlight(
	sourceNotePath: string,
	sourceText: string,
	mode: "jump" | "hover" = "jump",
	colorHint?: HighlightColor,
): void {
	highlightRequest.value = {
		sourceNotePath,
		sourceText,
		requestId: ++highlightCounter,
		mode,
		colorHint,
	};
}

export function clearSourceHighlight(): void {
	highlightRequest.value = null;
}
