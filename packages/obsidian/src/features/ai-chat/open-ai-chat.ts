import { Notice } from "obsidian";

import { VIEW_TYPE_AI_CHAT } from "@true-recall/core/constants";

import type TrueRecallPlugin from "../../main";
import type { StartChatOptions } from "./chat-controller";

/** The chat is a Pro feature; the model follows Settings → AI (Pro or the user's own key). */
export function isAiChatAvailable(plugin: TrueRecallPlugin): boolean {
	return !!plugin.settings.proKey;
}

function explainProOnly(): void {
	new Notice(
		"The AI chat is part of True Recall Pro. Add your Pro key in Settings → AI.",
	);
}

/** Shows the chat view in the right sidebar (full screen on phones). */
export async function revealAiChat(plugin: TrueRecallPlugin): Promise<void> {
	const { workspace } = plugin.app;
	const existing = workspace.getLeavesOfType(VIEW_TYPE_AI_CHAT)[0];
	const leaf = existing ?? workspace.getRightLeaf(false);
	if (!leaf) return;
	if (!existing) {
		await leaf.setViewState({ type: VIEW_TYPE_AI_CHAT, active: true });
	}
	await workspace.revealLeaf(leaf);
}

/** Opens the chat, optionally starting a conversation with context. */
export async function openAiChat(
	plugin: TrueRecallPlugin,
	options?: StartChatOptions,
): Promise<void> {
	if (!isAiChatAvailable(plugin)) {
		explainProOnly();
		return;
	}
	const controller = plugin.aiChat;
	if (!controller) return;
	if (options) {
		await controller.start(options);
		return;
	}
	await revealAiChat(plugin);
}
