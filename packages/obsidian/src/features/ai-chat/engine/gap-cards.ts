import type { AssistantReviewAttemptContext } from "@true-recall/core/ai/assistant";

/**
 * The request behind "Cards from gaps": new cards only for what the graded
 * attempt missed or got wrong, each point checked against existing cards
 * first. Sent as the user's message (not a preset), so the run stays a plain
 * chat: the model may search before proposing, and may propose nothing.
 */
export function buildGapCardsRequest(
	attempt: Pick<AssistantReviewAttemptContext, "missing" | "errors">,
): string {
	const points = [
		...(attempt.missing ?? []).map((p) => `- missing: ${p.trim()}`),
		...(attempt.errors ?? []).map((p) => `- wrong in my answer: ${p.trim()}`),
	].filter((line) => !line.endsWith(": "));
	return [
		"Make flashcards from the gaps in my answer to this card (REVIEW ATTEMPT). Only these points:",
		points.join("\n"),
		"",
		"1. Before proposing, call search_cards for each point with one or two key terms (word stems, in the card's language).",
		"2. Skip a point when an existing card already asks for it: its question targets that fact (the card in context counts too, so never repeat its question). A fact that only appears inside a longer answer, like the answer of the card in context, is not covered: that is the gap to make a card for.",
		"3. For a wrong point, the card asks for the correct fact, not the mistake.",
		"4. Propose the remaining points in one propose_cards call. Follow CARD RULES: one fact per card, short answers, in the card's language. Ask the general rule, not trivia about this card.",
		"5. Before propose_cards, write one short line in the card's language naming the points you skipped as already covered and the card that covers each (by its question, never its id).",
		"6. If every point is already covered, propose nothing and say so in one sentence.",
	].join("\n");
}
