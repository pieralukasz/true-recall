import { type ReadonlySignal, signal } from "@preact/signals";
import type { HighlightColor } from "@true-recall/obsidian/helpers/fsrs-colors";

// ── Card mutation types (used by session-helpers, ReviewView) ──

export type CardMutationAction =
	| "added"
	| "removed"
	| "reset"
	| "update"
	| "reschedule"
	| "suspend"
	| "unsuspend";

export type LegacyCardMutationAction = "delete";

export type CardMutationActionInput =
	| CardMutationAction
	| LegacyCardMutationAction;

export type CardMutationActionSemantics = "queue-remove" | "queue-sync";

const CARD_MUTATION_ACTION_ALIASES: Record<
	LegacyCardMutationAction,
	CardMutationAction
> = {
	delete: "removed",
};

const CARD_MUTATION_ACTION_SET: Set<CardMutationAction> = new Set([
	"added",
	"removed",
	"reset",
	"update",
	"reschedule",
	"suspend",
	"unsuspend",
]);

export const CARD_MUTATION_ACTION_SEMANTICS: Record<
	CardMutationAction,
	CardMutationActionSemantics
> = {
	added: "queue-sync",
	removed: "queue-remove",
	reset: "queue-sync",
	update: "queue-sync",
	reschedule: "queue-sync",
	suspend: "queue-sync",
	unsuspend: "queue-sync",
};

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
	action?: CardMutationActionInput;
	sourceNoteName?: string;
	rating?: number;
	newState?: number;
}

const _lastMutation = signal<CardMutation | null>(null);
export const lastMutation: ReadonlySignal<CardMutation | null> = _lastMutation;

export function normalizeCardMutationAction(
	action?: string,
): CardMutationAction | undefined {
	if (!action) return undefined;
	if (CARD_MUTATION_ACTION_SET.has(action as CardMutationAction)) {
		return action as CardMutationAction;
	}
	return CARD_MUTATION_ACTION_ALIASES[action as LegacyCardMutationAction];
}

export function getNormalizedCardMutationAction(
	mutation: CardMutation,
): CardMutationAction | undefined {
	const normalizedAction = normalizeCardMutationAction(mutation.action);
	if (normalizedAction) return normalizedAction;
	switch (mutation.type) {
		case "added":
			return "added";
		case "updated":
			return "update";
		case "removed":
			return "removed";
		case "bulk":
			return "update";
		default:
			return undefined;
	}
}

export function setLastMutation(mutation: CardMutation): void {
	_lastMutation.value = mutation;
}

// ── Source text highlight (Card → Text jump) ────────────────

export type { HighlightColor } from "@true-recall/obsidian/helpers/fsrs-colors";

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
