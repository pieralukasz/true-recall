import { Modal } from "obsidian";
import { h } from "preact";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { mountPreact } from "@true-recall/obsidian/preact/mount";

import { type AskAiEntry, AskAiPrompt } from "./AskAiPrompt";
import { AssistantInlineTask } from "./AssistantInlineTask";
import type { AIWorkspaceMode } from "./ai-workspace-modes";
import { handoffUnfinishedThread } from "./thread-handoff";

export interface AskAiModalOptions {
	context: AssistantContext;
	/** Fast paths land on the preset list; roomy ones on the composer. */
	entry?: AskAiEntry;
	initialMode?: AIWorkspaceMode;
	onClose?: () => void;
}

/** Opens the Ask AI prompt in a neutral modal. This is the mobile surface and
 * the desktop fallback when there is nowhere to dock or anchor. The composer is
 * the modal content directly — no inner framed box, one scroll container. */
export function openAskAiModal(
	plugin: TrueRecallPlugin,
	{
		context,
		entry = "compose",
		initialMode = "assistant",
		onClose,
	}: AskAiModalOptions,
): () => void {
	const modal = new Modal(plugin.app);
	modal.titleEl.setText("Ask AI");
	modal.modalEl.addClass("tr-assistant-modal");
	const host = modal.contentEl.createDiv();
	let unmount: (() => void) | null = null;
	let currentThreadId: string | null = null;
	const showThread = (threadId: string) => {
		currentThreadId = threadId;
		unmount?.();
		unmount = mountPreact(
			host,
			plugin,
			h(AssistantInlineTask, {
				threadId,
				framed: false,
				onClose: () => modal.close(),
			}),
		);
	};
	unmount = mountPreact(
		host,
		plugin,
		h(AskAiPrompt, {
			context,
			entry,
			initialMode,
			onSubmitted: (threadId, mode) => {
				if (mode === "inbox") {
					modal.close();
					void plugin.openAssistantInbox();
					return;
				}
				if (mode === "background") {
					modal.close();
					return;
				}
				showThread(threadId);
			},
			onDismiss: () => modal.close(),
		}),
	);
	modal.onClose = () => {
		if (currentThreadId) handoffUnfinishedThread(plugin, currentThreadId);
		unmount?.();
		onClose?.();
	};
	modal.open();
	return () => modal.close();
}

export function openAssistantThreadModal(
	plugin: TrueRecallPlugin,
	threadId: string,
): void {
	const modal = new Modal(plugin.app);
	modal.titleEl.setText("AI Draft Studio");
	modal.modalEl.addClass("tr-assistant-modal");
	const host = modal.contentEl.createDiv();
	const unmount = mountPreact(
		host,
		plugin,
		h(AssistantInlineTask, {
			threadId,
			framed: false,
			onClose: () => modal.close(),
		}),
	);
	modal.onClose = () => {
		handoffUnfinishedThread(plugin, threadId);
		unmount();
	};
	modal.open();
}
