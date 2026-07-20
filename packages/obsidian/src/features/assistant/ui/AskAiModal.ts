import { Modal } from "obsidian";
import { h } from "preact";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { mountPreact } from "@true-recall/obsidian/preact/mount";

import { AskAiPrompt } from "./AskAiPrompt";
import { AssistantInlineTask } from "./AssistantInlineTask";
import { handoffUnfinishedThread } from "./thread-handoff";

/** Opens the Ask AI prompt in a neutral modal (anchor-less invocations:
 * whole-card action in review, selection toolbar event). The composer is the
 * modal content directly — no inner framed box, one scroll container. */
export function openAskAiModal(
	plugin: TrueRecallPlugin,
	context: AssistantContext,
): void {
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
	};
	modal.open();
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
