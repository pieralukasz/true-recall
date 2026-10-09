import type { TFile } from "obsidian";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

/**
 * What a conversation is about. Stored with the chat, so a conversation keeps
 * its note, selection or card after the user moves on.
 */
export interface ChatContext {
	note?: { path: string; title: string };
	selection?: { text: string; notePath?: string };
	/** `label` is the question, shortened, for the chip. */
	card?: { id: string; label?: string };
	/**
	 * A Generator or Card Polish preset the request follows. Generator presets
	 * carry their id: generate_cards runs them as the panel's generator would.
	 */
	preset?: { id?: string; name: string; instruction: string };
}

export type ChatContextKind = "note" | "selection" | "card" | "preset";

export function contextKinds(context: ChatContext): ChatContextKind[] {
	const kinds: ChatContextKind[] = [];
	if (context.card) kinds.push("card");
	if (context.selection) kinds.push("selection");
	if (context.note) kinds.push("note");
	if (context.preset) kinds.push("preset");
	return kinds;
}

export function withoutKind(
	context: ChatContext,
	kind: ChatContextKind,
): ChatContext {
	const next = { ...context };
	delete next[kind];
	return next;
}

export function noteContext(file: TFile | null): ChatContext["note"] {
	if (!file || file.extension !== "md") return undefined;
	return { path: file.path, title: file.basename };
}

/** One line, at most `max` characters. */
export function shorten(text: string, max: number): string {
	const line = text
		.replace(/[*_`#>[\]]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Title for the history list: the first request, or the context it is about. */
export function chatTitle(firstMessage: string, context: ChatContext): string {
	const text = shorten(firstMessage, 60);
	if (text) return text;
	return context.note?.title ?? context.card?.label ?? "New chat";
}

/**
 * The old assistant's context (AI Workspace, Ask AI, quick editor, review),
 * mapped to the chat's. Old entry points keep building what they built.
 */
export function fromAssistantContext(
	context: AssistantContext,
	resolveNote: (path: string) => TFile | null,
): ChatContext {
	const notePath =
		context.card?.sourceNotePath ??
		context.source?.path ??
		context.activeNotePath;
	const note = notePath ? noteContext(resolveNote(notePath)) : undefined;
	const selection = context.selectedText?.trim();
	return {
		...(note ? { note } : {}),
		...(selection
			? { selection: { text: selection, notePath: note?.path } }
			: {}),
		...(context.card
			? {
					card: {
						id: context.card.cardId,
						label: shorten(context.card.question, 60),
					},
				}
			: {}),
	};
}
