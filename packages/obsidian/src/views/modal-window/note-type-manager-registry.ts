/**
 * Multi-instance registry for the Note Type Manager popout. Each
 * `openNoteTypeManager()` call registers a unique requestId and an optional
 * `onClose` callback; the view consumes the entry on mount and invokes the
 * callback when the popout closes. The registry exists because Obsidian
 * `setViewState` only persists JSON-serializable state — function callbacks
 * cannot live there.
 */

export type NoteTypeManagerRequestId = string & {
	readonly __brand: "NoteTypeManagerRequestId";
};

interface PendingRequest {
	onClose?: () => void;
}

const pending = new Map<NoteTypeManagerRequestId, PendingRequest>();

export function registerNoteTypeManagerRequest(
	requestId: NoteTypeManagerRequestId,
	onClose?: () => void,
): void {
	const existing = pending.get(requestId);
	if (existing) {
		existing.onClose?.();
	}
	pending.set(requestId, { onClose });
}

export function consumeNoteTypeManagerRequest(
	requestId: NoteTypeManagerRequestId,
): PendingRequest | undefined {
	const entry = pending.get(requestId);
	if (entry) pending.delete(requestId);
	return entry;
}

export function drainNoteTypeManagerRequests(): void {
	for (const entry of pending.values()) {
		try {
			entry.onClose?.();
		} catch (err) {
			console.warn(
				"[true-recall] note-type-manager-registry: onClose threw during drain",
				err,
			);
		}
	}
	pending.clear();
}

export function newNoteTypeManagerRequestId(): NoteTypeManagerRequestId {
	return `ntm-${crypto.randomUUID()}` as NoteTypeManagerRequestId;
}
