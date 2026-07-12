import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { h } from "preact";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { mountPreact } from "@true-recall/obsidian/preact/mount";

import { AskAiPrompt } from "./AskAiPrompt";

/** Opens the Ask AI prompt anchored to a rect (e.g. a selection). Returns a dispose fn. */
export function openAskAiPopover(
	plugin: TrueRecallPlugin,
	anchorRect: DOMRect,
	context: AssistantContext,
): () => void {
	const container = activeDocument.body.createDiv({
		cls: "tr-ask-ai-popover true-recall-selection-toolbar-container",
	});
	container.style.position = "absolute";
	container.style.zIndex = "var(--layer-menu)";

	let unmount: (() => void) | null = null;
	const dispose = () => {
		unmount?.();
		container.remove();
		activeDocument.removeEventListener("pointerdown", onPointerDown);
	};
	const onPointerDown = (e: PointerEvent) => {
		if (!container.contains(e.target as Node)) dispose();
	};
	activeDocument.addEventListener("pointerdown", onPointerDown);

	unmount = mountPreact(
		container,
		plugin,
		h(AskAiPrompt, {
			context,
			onSubmitted: (_taskId, showNow) => {
				dispose();
				if (showNow) void plugin.openAssistantInbox();
			},
			onDismiss: dispose,
		}),
	);

	const virtualEl = { getBoundingClientRect: () => anchorRect };
	void computePosition(virtualEl, container, {
		placement: "bottom-start",
		middleware: [offset(6), flip(), shift({ padding: 8 })],
	}).then(({ x, y }) => {
		container.style.left = `${x}px`;
		container.style.top = `${y}px`;
	});

	return dispose;
}
