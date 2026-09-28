import type { ChatContext } from "./chat-context";

export interface Suggestion {
	icon: string;
	label: string;
	detail: string;
	prompt: string;
	factCheck?: boolean;
}

export function suggestionsFor(
	context: ChatContext,
	canFactCheck: boolean,
): Suggestion[] {
	if (context.card) {
		return [
			{
				icon: "lightbulb",
				label: "Explain this card",
				detail: "In simple words, with an example",
				prompt: "Explain this card to me in simple words.",
			},
			{
				icon: "wand-sparkles",
				label: "Make it clearer",
				detail: "A better version for you to approve",
				prompt: "Improve this card so it is easier to remember.",
			},
			...(canFactCheck
				? [
						{
							icon: "shield-check",
							label: "Check the facts",
							detail: "Compared with sources on the web",
							prompt: "Check the facts on this card.",
							factCheck: true,
						},
					]
				: []),
		];
	}
	if (context.selection) {
		return [
			{
				icon: "layers",
				label: "Cards from the selection",
				detail: "You pick which ones to add",
				prompt: "Make flashcards from the selected text.",
			},
			{
				icon: "lightbulb",
				label: "Explain the selection",
				detail: "In simple words, with an example",
				prompt: "Explain the selected text to me.",
			},
		];
	}
	if (context.note) {
		return [
			{
				icon: "layers",
				label: "Cards from this note",
				detail: "You pick which ones to add",
				prompt: "Make flashcards from this note.",
			},
			{
				icon: "search",
				label: "What's missing?",
				detail: "Key ideas in this note with no card yet",
				prompt: "Which important ideas in this note have no card yet?",
			},
			{
				icon: "wand-sparkles",
				label: "Improve my cards",
				detail: "Fixes for the weakest cards from this note",
				prompt:
					"Review the cards from this note and suggest fixes for the weakest ones.",
			},
		];
	}
	return [
		{
			icon: "trending-up",
			label: "How am I doing?",
			detail: "Reviews, retention and what is due",
			prompt: "How is my studying going? Look at my stats.",
		},
		{
			icon: "flame",
			label: "My hardest cards",
			detail: "The ones you forget most, and how to fix them",
			prompt: "Which cards do I forget most, and how could they be better?",
		},
	];
}
