import { Menu } from "obsidian";

import type { AssistantReviewAttemptContext } from "@true-recall/core/ai/assistant";
import { findCardPolishPreset } from "@true-recall/core/ai/workflows/card-polish-builtins";
import type { FSRSFlashcardItem } from "@true-recall/core/types";

import { isFactCheckAvailable } from "@true-recall/obsidian/features/assistant/ui/fact-check";
import {
	listCardPolishWorkflows,
	startCardPolish,
} from "@true-recall/obsidian/features/library/ui/panel/utils/card-polish.utils";
import { showMenuForEvent } from "@true-recall/obsidian/utils/menu-position";

import { t } from "../../i18n";
import type TrueRecallPlugin from "../../main";
import { type ChatContext, noteContext, shorten } from "./engine/chat-context";
import { buildGapCardsRequest } from "./engine/gap-cards";
import { isAiChatAvailable, openAiChat } from "./open-ai-chat";

/**
 * Chat context for a card under review: the card, its source note and, after
 * a typed answer, that attempt with its grading.
 */
export function cardChatContext(
	plugin: TrueRecallPlugin,
	card: Pick<FSRSFlashcardItem, "id" | "question" | "sourceNotePath">,
	selectedText?: string,
	reviewAttempt?: AssistantReviewAttemptContext,
): ChatContext {
	const file = card.sourceNotePath
		? plugin.app.vault.getFileByPath(card.sourceNotePath)
		: null;
	return buildCardChatContext(
		card,
		noteContext(file),
		selectedText,
		reviewAttempt,
	);
}

/** {@link cardChatContext} without the vault lookup. */
export function buildCardChatContext(
	card: Pick<FSRSFlashcardItem, "id" | "question">,
	note: ChatContext["note"],
	selectedText?: string,
	reviewAttempt?: AssistantReviewAttemptContext,
): ChatContext {
	return {
		card: { id: card.id, label: shorten(card.question ?? "", 60) },
		...(note ? { note } : {}),
		...(selectedText?.trim()
			? { selection: { text: selectedText.trim(), notePath: note?.path } }
			: {}),
		...(reviewAttempt ? { reviewAttempt } : {}),
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

/**
 * A question typed after the answer, answered under the card. With a typed
 * answer, the model also gets that attempt and its grading.
 */
export function askAboutCard(
	plugin: TrueRecallPlugin,
	card: FSRSFlashcardItem,
	question: string,
	reviewAttempt?: AssistantReviewAttemptContext,
): void {
	void plugin.aiChat?.startForCard(card.id, {
		context: cardChatContext(plugin, card, undefined, reviewAttempt),
		message: question,
	});
}

/**
 * "Cards from gaps": new cards for what the typed answer missed or got wrong,
 * under the card. A plain chat run (chat_task "chat"), so the model can call
 * search_cards before proposing and may propose nothing.
 */
export function cardsFromGaps(
	plugin: TrueRecallPlugin,
	card: FSRSFlashcardItem,
	reviewAttempt: AssistantReviewAttemptContext,
): void {
	void plugin.aiChat?.startForCard(card.id, {
		context: cardChatContext(plugin, card, undefined, reviewAttempt),
		message: buildGapCardsRequest(reviewAttempt),
		title: t("Cards from gaps"),
	});
}

/**
 * The review's AI menu: Card Polish presets, fact check, and "ask" (opens the
 * chat). Results of the first two show under the card.
 */
export function showCardAiMenu(
	plugin: TrueRecallPlugin,
	card: FSRSFlashcardItem,
	event: MouseEvent | KeyboardEvent,
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
				.onClick(() => {
					// Local presets (Clean) run without AI, like their command does.
					const executor =
						findCardPolishPreset(plugin.settings, workflow.sourcePresetId)
							?.executor ?? "ai";
					if (executor !== "ai") {
						startCardPolish(plugin, workflow, card);
						return;
					}
					polishCard(plugin, card, {
						name: workflow.name,
						instruction: workflow.instruction,
					});
				}),
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
	showMenuForEvent(menu, event);
}
