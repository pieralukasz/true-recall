/**
 * Multi-instance registry for the Card Types Editor popout. Each
 * `openCardTypesEditor()` call registers a unique requestId and an optional
 * `onClose` callback; the view consumes the entry on mount and invokes the
 * callback when the popout closes. The registry exists because Obsidian
 * `setViewState` only persists JSON-serializable state — function callbacks
 * cannot live there.
 */

export type CardTypesEditorRequestId = string & {
	readonly __brand: "CardTypesEditorRequestId";
};

interface PendingRequest {
	noteTypeId: string;
	onClose?: () => void;
}

const pending = new Map<CardTypesEditorRequestId, PendingRequest>();

export function registerCardTypesEditorRequest(
	requestId: CardTypesEditorRequestId,
	noteTypeId: string,
	onClose?: () => void,
): void {
	const existing = pending.get(requestId);
	if (existing) {
		existing.onClose?.();
	}
	pending.set(requestId, { noteTypeId, onClose });
}

export function consumeCardTypesEditorRequest(
	requestId: CardTypesEditorRequestId,
): PendingRequest | undefined {
	const entry = pending.get(requestId);
	if (entry) pending.delete(requestId);
	return entry;
}

export function drainCardTypesEditorRequests(): void {
	for (const entry of pending.values()) {
		try {
			entry.onClose?.();
		} catch (err) {
			console.warn(
				"[true-recall] card-types-editor-registry: onClose threw during drain",
				err,
			);
		}
	}
	pending.clear();
}

export function newCardTypesEditorRequestId(): CardTypesEditorRequestId {
	return `cte-${crypto.randomUUID()}` as CardTypesEditorRequestId;
}
