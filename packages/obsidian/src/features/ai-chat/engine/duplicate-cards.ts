import type TrueRecallPlugin from "../../../main";
import type { ChatContext } from "./chat-context";
import type { ProposedCard } from "./proposals";

/**
 * A question as compared for duplicates: no markdown emphasis or code marks,
 * one space, lower case, no closing punctuation. "**Ohm's law**?" and
 * "ohm's  law" are the same question.
 */
export function normalizeQuestion(question: string): string {
	return question
		.normalize("NFC")
		.replace(/[*_`=~]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
		.replace(/[\s?!.:;…]+$/u, "");
}

/**
 * Which proposed cards repeat an existing question (normalized match against
 * `existing`, or `exists` for a collection-wide lookup) or an earlier card of
 * the same proposal.
 */
export function flagDuplicateCards(
	cards: readonly Pick<ProposedCard, "question">[],
	existing: Iterable<string>,
	exists: (question: string) => boolean = () => false,
): boolean[] {
	const seen = new Set<string>();
	for (const q of existing) {
		const key = normalizeQuestion(q);
		if (key) seen.add(key);
	}
	return cards.map((card) => {
		const question = card.question ?? "";
		const key = normalizeQuestion(question);
		if (!key) return false;
		if (seen.has(key) || exists(question.trim())) return true;
		seen.add(key);
		return false;
	});
}

/**
 * Questions of the cards the proposal lives next to: the card in context and
 * every card of its source note and of the chat's note.
 */
export function nearbyQuestions(
	plugin: TrueRecallPlugin,
	context: ChatContext,
): string[] {
	const store = plugin.cardStore;
	if (!store) return [];
	const uids = new Set<string>();
	const questions: string[] = [];
	const card = context.card ? store.cards.get(context.card.id) : undefined;
	if (card) {
		questions.push(card.question ?? "");
		if (card.sourceUid) uids.add(card.sourceUid);
	}
	const notePath = context.note?.path ?? context.selection?.notePath;
	const file = notePath
		? plugin.app.vault?.getFileByPath?.(notePath)
		: undefined;
	const uid: unknown = file
		? plugin.app.metadataCache?.getFileCache(file)?.frontmatter?.flashcard_uid
		: undefined;
	if (typeof uid === "string" && uid) uids.add(uid);
	for (const sourceUid of uids) {
		for (const sibling of store.cards.getCardsBySourceUid(sourceUid)) {
			questions.push(sibling.question ?? "");
		}
	}
	return questions;
}

/**
 * Duplicate flags for a proposal shown in the chat or under a card: the
 * nearby cards by normalized question, the whole collection by exact
 * question (the same check `skipDuplicates` makes when cards are added).
 */
export function findDuplicateProposals(
	plugin: TrueRecallPlugin,
	context: ChatContext,
	cards: readonly Pick<ProposedCard, "question">[],
): boolean[] {
	const store = plugin.cardStore;
	return flagDuplicateCards(
		cards,
		nearbyQuestions(plugin, context),
		(question) => !!store?.cards.getCardIdByQuestion(question),
	);
}
