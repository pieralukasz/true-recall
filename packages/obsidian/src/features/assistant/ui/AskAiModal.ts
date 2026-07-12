import { Modal } from "obsidian";
import { h } from "preact";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { mountPreact } from "@true-recall/obsidian/preact/mount";

import { AskAiPrompt } from "./AskAiPrompt";

/** Opens the Ask AI prompt in a modal (used outside review / from commands). */
export function openAskAiModal(
	plugin: TrueRecallPlugin,
	context: AssistantContext,
): void {
	const modal = new Modal(plugin.app);
	modal.titleEl.setText("Ask AI");
	const host = modal.contentEl.createDiv();
	const unmount = mountPreact(
		host,
		plugin,
		h(AskAiPrompt, {
			context,
			onSubmitted: (_taskId, showNow) => {
				modal.close();
				if (showNow) void plugin.openAssistantInbox();
			},
			onDismiss: () => modal.close(),
		}),
	);
	modal.onClose = () => unmount();
	modal.open();
}
