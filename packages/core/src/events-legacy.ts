/**
 * Simple event emitter for card change notifications.
 * Platform-agnostic replacement for @preact/signals-based notifyCardChange.
 */

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

export type CardChangeListener = (mutation: CardMutation) => void;

const listeners: CardChangeListener[] = [];

export function notifyCardChange(mutation: CardMutation): void {
	for (const listener of listeners) {
		try {
			listener(mutation);
		} catch (e) {
			console.error("[core/events] Card change listener error:", e);
		}
	}
}

export function onCardChange(listener: CardChangeListener): () => void {
	listeners.push(listener);
	return () => {
		const idx = listeners.indexOf(listener);
		if (idx >= 0) listeners.splice(idx, 1);
	};
}
