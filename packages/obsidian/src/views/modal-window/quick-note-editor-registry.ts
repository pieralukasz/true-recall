import type {
	QuickNoteEditorMode,
	QuickNoteEditorResult,
} from "@true-recall/obsidian/modals/study/quick-note-editor/types";

export type QuickNoteEditorRequestId = string & {
	readonly __brand: "QuickNoteEditorRequestId";
};

interface PendingRequest {
	mode: QuickNoteEditorMode;
	resolve: (result: QuickNoteEditorResult) => void;
}

const pending = new Map<QuickNoteEditorRequestId, PendingRequest>();

export function registerQuickNoteEditorRequest(
	requestId: QuickNoteEditorRequestId,
	mode: QuickNoteEditorMode,
	resolve: (result: QuickNoteEditorResult) => void,
): void {
	const existing = pending.get(requestId);
	if (existing) {
		// Should not happen with UUID-based ids; resolve the orphaned request
		// rather than silently overwrite its resolver.
		existing.resolve({ cancelled: true });
	}
	pending.set(requestId, { mode, resolve });
}

export function consumeQuickNoteEditorRequest(
	requestId: QuickNoteEditorRequestId,
): PendingRequest | undefined {
	const entry = pending.get(requestId);
	if (entry) pending.delete(requestId);
	return entry;
}

export function newQuickNoteEditorRequestId(): QuickNoteEditorRequestId {
	return `qne-${crypto.randomUUID()}` as QuickNoteEditorRequestId;
}
