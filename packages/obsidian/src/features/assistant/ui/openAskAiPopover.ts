import {
	autoUpdate,
	computePosition,
	flip,
	offset,
	shift,
} from "@floating-ui/dom";
import { h } from "preact";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { mountPreact } from "@true-recall/obsidian/preact/mount";

import { AskAiPrompt } from "./AskAiPrompt";
import { AssistantInlineTask } from "./AssistantInlineTask";
import type { AIWorkspaceMode } from "./ai-workspace-modes";
import { handoffUnfinishedThread } from "./thread-handoff";

/** Opens the Ask AI prompt anchored to a rect (e.g. a selection or a toolbar
 * button). This is the fast surface: it lands on the preset list, one click from
 * running a saved instruction. Returns a dispose fn. */
export function openAskAiPopover(
	plugin: TrueRecallPlugin,
	anchorRect: DOMRect,
	context: AssistantContext,
	initialMode: AIWorkspaceMode = "assistant",
): () => void {
	const container = activeDocument.body.createDiv({
		cls: "tr-ask-ai-popover true-recall-selection-toolbar-container",
	});
	container.setCssStyles({ position: "absolute", zIndex: "var(--layer-menu)" });

	let unmount: (() => void) | null = null;
	let stopPositioning: (() => void) | null = null;
	let currentThreadId: string | null = null;
	let disposed = false;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		unmount?.();
		stopPositioning?.();
		container.remove();
		activeDocument.removeEventListener("pointerdown", onPointerDown);
	};
	const closeSurface = () => {
		if (currentThreadId) handoffUnfinishedThread(plugin, currentThreadId);
		dispose();
	};
	const onPointerDown = (e: PointerEvent) => {
		if (!container.contains(e.target as Node)) closeSurface();
	};
	activeDocument.addEventListener("pointerdown", onPointerDown);

	const showThread = (threadId: string) => {
		currentThreadId = threadId;
		container.addClass("has-thread");
		unmount?.();
		unmount = mountPreact(
			container,
			plugin,
			h(AssistantInlineTask, { threadId, onClose: closeSurface }),
		);
	};

	unmount = mountPreact(
		container,
		plugin,
		h(AskAiPrompt, {
			context,
			entry: "presets",
			initialMode,
			autoFocus: false,
			class: "ep:shadow-lg",
			onSubmitted: (threadId, mode) => {
				if (mode === "inbox") {
					dispose();
					void plugin.openAssistantInbox();
					return;
				}
				if (mode === "background") {
					dispose();
					return;
				}
				showThread(threadId);
			},
			onDismiss: dispose,
		}),
	);

	const virtualEl = { getBoundingClientRect: () => anchorRect };
	const updatePosition = () => {
		void computePosition(virtualEl, container, {
			placement: "bottom-start",
			middleware: [offset(6), flip(), shift({ padding: 8 })],
		}).then(({ x, y }) => {
			container.setCssStyles({ left: `${x}px`, top: `${y}px` });
		});
	};
	stopPositioning = autoUpdate(virtualEl, container, updatePosition);

	return dispose;
}
