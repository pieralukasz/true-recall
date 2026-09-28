import { jsonSchema, ToolLoopAgent, tool } from "ai";

import type TrueRecallPlugin from "../../main";
import { createDemoModel, type DemoContext } from "./demo-model";

export interface ProposedCard {
	question: string;
	answer: string;
}

export interface ProposeCardsInput {
	notePath: string | null;
	cards: ProposedCard[];
}

export interface ProposeCardEditInput {
	cardId: string;
	question?: string;
	answer?: string;
}

/**
 * Tools that change cards have no `execute`: the chat renders them as a
 * proposal and the user's click writes the cards and returns the result to
 * the model (see ProposalCards / ProposalEdit).
 */
export const chatTools = {
	propose_cards: tool({
		description:
			"Propose new flashcards for the user to review. Nothing is saved until the user adds them in the chat; the result says how many were added.",
		inputSchema: jsonSchema<ProposeCardsInput>({
			type: "object",
			properties: {
				notePath: { type: ["string", "null"], description: "Source note path" },
				cards: {
					type: "array",
					items: {
						type: "object",
						properties: {
							question: { type: "string" },
							answer: { type: "string" },
						},
						required: ["question", "answer"],
					},
				},
			},
			required: ["cards"],
		}),
	}),
	propose_card_edit: tool({
		description:
			"Propose a new question and/or answer for an existing card. The user applies or skips it in the chat.",
		inputSchema: jsonSchema<ProposeCardEditInput>({
			type: "object",
			properties: {
				cardId: { type: "string" },
				question: { type: "string" },
				answer: { type: "string" },
			},
			required: ["cardId"],
		}),
	}),
};

export function demoContext(plugin: TrueRecallPlugin): DemoContext {
	const file = plugin.app.workspace.getActiveFile();
	if (!file || file.extension !== "md")
		return { notePath: null, noteTitle: null, firstCard: null };
	const uid = plugin.app.metadataCache.getFileCache(file)?.frontmatter
		?.flashcard_uid as string | undefined;
	const card = uid
		? plugin.cardStore.cards.getCardsBySourceUid(uid)[0]
		: undefined;
	return {
		notePath: file.path,
		noteTitle: file.basename,
		firstCard: card
			? {
					id: card.id,
					question: card.question ?? "",
					answer: card.answer ?? "",
				}
			: null,
	};
}

export function createChatAgent(plugin: TrueRecallPlugin) {
	return new ToolLoopAgent({
		model: createDemoModel(() => demoContext(plugin)),
		instructions: "You help the user study with True Recall flashcards.",
		tools: chatTools,
	});
}
