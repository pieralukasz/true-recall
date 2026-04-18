export interface ExistingCardContext {
	id: string;
	question: string;
	answer: string;
}

export const EXISTING_CARDS_MAX_COUNT = 50;
export const EXISTING_CARDS_MAX_TOKENS = 3000;
const EMPTY_SENTINEL = "No existing cards yet for this note.";

function escapePipes(value: string): string {
	return value.replaceAll("|", "\\|");
}

function formatCard(card: ExistingCardContext): string {
	return `- Q: ${escapePipes(card.question)} | A: ${escapePipes(card.answer)}`;
}

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Render a list of existing cards into the `{{EXISTING_CARDS}}` prompt block.
 * Caller is responsible for ordering (most-recent first is recommended so that
 * truncation drops the oldest).
 */
export function renderExistingCardsBlock(
	cards: ExistingCardContext[],
): string {
	if (cards.length === 0) {
		return EMPTY_SENTINEL;
	}

	const capped = cards.slice(0, EXISTING_CARDS_MAX_COUNT);
	let lines = capped.map(formatCard);
	let rendered = lines.join("\n");

	while (
		lines.length > 1 &&
		estimateTokens(rendered) > EXISTING_CARDS_MAX_TOKENS
	) {
		lines = lines.slice(0, -1);
		rendered = lines.join("\n");
	}

	return rendered;
}
