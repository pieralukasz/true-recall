import { renderClozeAnswer } from "@features/study/services/flashcard/cloze-parser.service";
import type { CardType } from "@shared/types/fsrs/card.types";

// ── Types ───────────────────────────────────────────────

export interface CardLike {
	question: string;
	answer: string;
	cardType?: CardType;
	clozeTemplate?: string;
	clozeIndex?: number;
	reverseOfBatchId?: string;
}

// ── Serialize: Card → Markdown ──────────────────────────

/**
 * Convert a single card (any type) to editable `Front :: Back` format.
 *
 * - basic/undefined → "question :: answer"
 * - cloze with extra → "clozeTemplate :: extra"
 * - cloze without extra → just the clozeTemplate (standalone cloze line)
 * - reversed → "answer :: question" (outputs original Q/A pair)
 */
export function cardToMarkdown(card: CardLike): string {
	if (card.cardType === "cloze" && card.clozeTemplate) {
		const extra = extractClozeExtraAnswer(card);
		return extra
			? `${card.clozeTemplate} :: ${extra}`
			: card.clozeTemplate;
	}

	// Reversed cards store origA as question and origQ as answer; swap back for serialization
	if (card.cardType === "reversed") {
		return card.question
			? `${card.answer} :: ${card.question}`
			: card.answer;
	}

	return card.answer
		? `${card.question} :: ${card.answer}`
		: card.question;
}

/**
 * Convert multiple cards to markdown, handling groups intelligently:
 * - Cloze siblings (same template) → deduplicated to one line
 * - Reverse pairs (original + reversed) → deduplicated to one line
 * - Lines separated by \n
 */
export function cardsToMarkdown(cards: CardLike[]): string {
	if (cards.length === 0) return "";

	const blocks: string[] = [];
	const emittedClozeTemplates = new Set<string>();
	const emittedReversePairs = new Set<string>();

	const reverseByOriginal = new Map<string, CardLike>();
	for (const card of cards) {
		if (card.cardType === "reversed" && card.reverseOfBatchId) {
			reverseByOriginal.set(card.reverseOfBatchId, card);
		}
	}

	for (const card of cards) {
		if (card.cardType === "cloze" && card.clozeTemplate) {
			if (!emittedClozeTemplates.has(card.clozeTemplate)) {
				emittedClozeTemplates.add(card.clozeTemplate);
				const extra = extractClozeExtraAnswer(card);
				blocks.push(
					extra
						? `${card.clozeTemplate} :: ${extra}`
						: card.clozeTemplate,
				);
			}
			continue;
		}

		if (card.cardType === "reversed" && card.reverseOfBatchId) {
			continue;
		}

		const id = cardId(card);
		const reversed = reverseByOriginal.get(id);
		if (reversed && !emittedReversePairs.has(id)) {
			emittedReversePairs.add(id);
			blocks.push(
				card.answer
					? `${card.question} :: ${card.answer}`
					: card.question,
			);
			continue;
		}

		blocks.push(
			card.answer
				? `${card.question} :: ${card.answer}`
				: card.question,
		);
	}

	return blocks.join("\n");
}

// ── Helpers ─────────────────────────────────────────────

/**
 * Cloze answers are structured as: "rendered_answer\n\nextra_context"
 * where rendered_answer is the cloze template with the target index bolded.
 * Returns just the extra context portion, or "" if none exists.
 */
export function extractClozeExtraAnswer(card: {
	answer: string;
	clozeTemplate?: string;
	clozeIndex?: number;
}): string {
	if (!card.clozeTemplate || card.clozeIndex === undefined) return card.answer;

	const renderedAnswer = renderClozeAnswer(card.clozeTemplate, card.clozeIndex);

	if (!card.answer.startsWith(renderedAnswer)) return card.answer;

	const rest = card.answer.slice(renderedAnswer.length);
	if (rest.startsWith("\n\n")) return rest.slice(2);
	return rest.trim();
}

// ── Internal ────────────────────────────────────────────

function cardId(card: CardLike): string {
	return (card as { id?: string }).id ?? `${card.question}::${card.answer}`;
}
