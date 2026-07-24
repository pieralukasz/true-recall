import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type { AIWorkspaceMode } from "@true-recall/obsidian/features/assistant/ui/ai-workspace-modes";

export type AssistantEditorRequestId = string & {
	readonly __brand: "AssistantEditorRequestId";
};

export interface SourceWindowBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface PendingRequest {
	context: AssistantContext;
	sourceBounds: SourceWindowBounds | null;
	initialMode: AIWorkspaceMode;
	onClose?: () => void;
}

const pending = new Map<AssistantEditorRequestId, PendingRequest>();

export function registerAssistantEditorRequest(
	requestId: AssistantEditorRequestId,
	context: AssistantContext,
	sourceBounds: SourceWindowBounds | null,
	initialMode: AIWorkspaceMode,
	onClose?: () => void,
): void {
	const existing = pending.get(requestId);
	if (existing) existing.onClose?.();
	pending.set(requestId, { context, sourceBounds, initialMode, onClose });
}

export function consumeAssistantEditorRequest(
	requestId: AssistantEditorRequestId,
): PendingRequest | undefined {
	const entry = pending.get(requestId);
	if (entry) pending.delete(requestId);
	return entry;
}

export function drainAssistantEditorRequests(): void {
	for (const entry of pending.values()) {
		try {
			entry.onClose?.();
		} catch (error) {
			console.warn(
				"[true-recall] assistant-editor-registry: onClose threw during drain",
				error,
			);
		}
	}
	pending.clear();
}

export function newAssistantEditorRequestId(): AssistantEditorRequestId {
	return `ae-${crypto.randomUUID()}` as AssistantEditorRequestId;
}
