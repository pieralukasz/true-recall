import { Menu } from "obsidian";

import type { FSRSFlashcardItem } from "@true-recall/core/types";

import { isFactCheckAvailable } from "@true-recall/obsidian/features/assistant/ui/fact-check";
import { listCardPolishWorkflows } from "@true-recall/obsidian/features/library/ui/panel/utils/card-polish.utils";

import type TrueRecallPlugin from "../../main";
import { type ChatContext, noteContext, shorten } from "./engine/chat-context";
import { isAiChatAvailable, openAiChat } from "./open-ai-chat";

/** Chat context for a card under review: the card and its source note. */
export function cardChatContext(
	plugin: TrueRecallPlugin,
	card: Pick<FSRSFlashcardItem, "id" | "question" | "sourceNotePath">,
	selectedText?: string,
): ChatContext {
	const file = card.sourceNotePath
		? plugin.app.vault.getFileByPath(card.sourceNotePath)
		: null;
	const note = noteContext(file);
	return {
		card: { id: card.id, label: shorten(card.question ?? "", 60) },
		...(note ? { note } : {}),
		...(selectedText?.trim()
			? { selection: { text: selectedText.trim(), notePath: note?.path } }
			: {}),
	};
}

/** Card Polish preset, run under the card. */
export function polishCard(
	plugin: TrueRecallPlugin,
	card: FSRSFlashcardItem,
	preset: { name: string; instruction: string },
): void {
	void plugin.aiChat?.startForCard(card.id, {
		context: { ...cardChatContext(plugin, card), preset },
		message: `Polish this card: ${preset.name}`,
	});
}

/** Fact check with web sources, run under the card. */
export function factCheckCard(
	plugin: TrueRecallPlugin,
	card: FSRSFlashcardItem,
): void {
	void plugin.aiChat?.startForCard(card.id, {
		context: cardChatContext(plugin, card),
		factCheck: true,
		message: "Check the facts on this card.",
	});
}

/** A question typed after the answer, answered under the card. */
export function askAboutCard(
	plugin: TrueRecallPlugin,
	card: FSRSFlashcardItem,
	question: string,
): void {
	void plugin.aiChat?.startForCard(card.id, {
		context: cardChatContext(plugin, card),
		message: question,
	});
}

/**
 * The review's AI menu: Card Polish presets, fact check, and "ask" (opens the
 * chat). Results of the first two show under the card.
 */
export function showCardAiMenu(
	plugin: TrueRecallPlugin,
	card: FSRSFlashcardItem,
	event: MouseEvent,
): void {
	if (!isAiChatAvailable(plugin)) {
		void openAiChat(plugin);
		return;
	}
	const menu = new Menu();
	for (const workflow of listCardPolishWorkflows(plugin.settings)) {
		menu.addItem((item) =>
			item
				.setTitle(workflow.name)
				.setIcon("wand")
				.onClick(() =>
					polishCard(plugin, card, {
						name: workflow.name,
						instruction: workflow.instruction,
					}),
				),
		);
	}
	menu.addSeparator();
	// Needs web search (Pro or OpenRouter): without it the model cites memory.
	if (isFactCheckAvailable(plugin.settings)) {
		menu.addItem((item) =>
			item
				.setTitle("Check the facts")
				.setIcon("search-check")
				.onClick(() => factCheckCard(plugin, card)),
		);
	}
	menu.addItem((item) =>
		item
			.setTitle("Ask about this card")
			.setIcon("message-square")
			.onClick(
				() =>
					void openAiChat(plugin, { context: cardChatContext(plugin, card) }),
			),
	);
	menu.showAtMouseEvent(event);
}
