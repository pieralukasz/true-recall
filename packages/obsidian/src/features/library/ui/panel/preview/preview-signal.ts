import { signal } from "@preact/signals";

export const VIEW_TRANSITION_NAME = "tr-card-preview";

export const previewingCardIdSignal = signal<string | null>(null);

export function setPreviewingCard(cardId: string): void {
	previewingCardIdSignal.value = cardId;
}

export function clearPreviewingCard(): void {
	previewingCardIdSignal.value = null;
}

export function viewTransitionNameForCard(cardId: string): string | undefined {
	return previewingCardIdSignal.value === cardId
		? VIEW_TRANSITION_NAME
		: undefined;
}

export function withViewTransition(fn: () => void): void {
	const doc = activeDocument as Document & {
		startViewTransition?: (cb: () => void) => { finished: Promise<void> };
	};
	if (typeof doc.startViewTransition === "function") {
		doc.startViewTransition(fn);
	} else {
		fn();
	}
}
