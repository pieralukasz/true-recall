import { describe, expect, it, vi } from "vitest";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import {
	consumeAssistantEditorRequest,
	newAssistantEditorRequestId,
	registerAssistantEditorRequest,
} from "@true-recall/obsidian/views/modal-window/assistant-editor-registry";

const context: AssistantContext = { activeNotePath: "Notes/source.md" };
const sourceBounds = { x: 100, y: 120, width: 720, height: 500 };

describe("assistant-editor-registry", () => {
	it("creates unique prefixed request ids", () => {
		const ids = new Set(
			Array.from({ length: 50 }, () => newAssistantEditorRequestId()),
		);
		expect(ids.size).toBe(50);
		expect([...ids][0]).toMatch(/^ae-/);
	});

	it("roundtrips the contextual AI request once", () => {
		const id = newAssistantEditorRequestId();
		const onClose = vi.fn();
		registerAssistantEditorRequest(
			id,
			context,
			sourceBounds,
			"assistant",
			onClose,
		);

		const entry = consumeAssistantEditorRequest(id);
		expect(entry?.context).toBe(context);
		expect(entry?.sourceBounds).toBe(sourceBounds);
		expect(entry?.initialMode).toBe("assistant");
		expect(entry?.onClose).toBe(onClose);
		expect(consumeAssistantEditorRequest(id)).toBeUndefined();
	});

	it("notifies the previous request when a duplicate id is replaced", () => {
		const id = newAssistantEditorRequestId();
		const firstOnClose = vi.fn();
		registerAssistantEditorRequest(
			id,
			context,
			null,
			"assistant",
			firstOnClose,
		);
		registerAssistantEditorRequest(id, context, sourceBounds, "generator");

		expect(firstOnClose).toHaveBeenCalledOnce();
		expect(consumeAssistantEditorRequest(id)?.sourceBounds).toBe(sourceBounds);
	});
});
