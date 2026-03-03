import {
	parseClozeTemplate,
	renderClozeAnswer,
} from "@features/study/services/flashcard/cloze-parser.service";
import type { CardType } from "@shared/types/fsrs/card.types";

const CLOZE_DETECT = /\{\{c\d+::[^}]*?(?:::[^}]*?)?\}\}/;

// :: separator not inside cloze braces {{c1::text}}
const INLINE_SEPARATOR_RE = /^(.+?)(?<!{[^}]*)::(?![^{]*}})(.+)$/;

// ── Types ───────────────────────────────────────────────

export interface CardLike {
	question: string;
	answer: string;
	cardType?: CardType;
	clozeTemplate?: string;
	clozeIndex?: number;
	reverseOfBatchId?: string;
}

export interface CardPreview {
	label: string;
	question: string;
	answer: string;
	cardType: "basic" | "cloze" | "reversed";
}

// ── Serialize: Card → Markdown ──────────────────────────

/**
 * Convert a single card (any type) to editable `Front :: Back` format.
 *
 * - basic/undefined → "question :: answer"
 * - cloze → "clozeTemplate :: extra" (uses clozeTemplate, not rendered Q/A)
 * - reversed → "answer :: question" (outputs original Q/A pair)
 */
export function cardToMarkdown(card: CardLike): string {
	if (card.cardType === "cloze" && card.clozeTemplate) {
		const extra = extractClozeExtraAnswer(card);
		return extra
			? `${card.clozeTemplate} :: ${extra}`
			: card.clozeTemplate;
	}

	// For reversed cards, output as the original Q/A pair
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

// ── Preview ─────────────────────────────────────────────

/**
 * Parse input text and generate structured preview of all cards that would be created.
 * Parses `Front :: Back` lines; detects cloze syntax in the question side.
 */
export function previewCards(content: string): CardPreview[] {
	if (!content.trim()) return [];

	const previews: CardPreview[] = [];
	const lines = content.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const match = trimmed.match(INLINE_SEPARATOR_RE);
		if (!match) continue;

		const question = match[1]!.trim();
		const answer = match[2]!.trim();
		if (!question || !answer) continue;

		if (CLOZE_DETECT.test(question)) {
			const clozeCards = parseClozeTemplate(question);
			for (const cloze of clozeCards) {
				const fullAnswer = answer
					? `${cloze.answer}\n\n${answer}`
					: cloze.answer;
				previews.push({
					label: `Cloze ${cloze.clozeIndex}`,
					question: cloze.question,
					answer: fullAnswer,
					cardType: "cloze",
				});
			}
		} else {
			previews.push({
				label: "Basic",
				question,
				answer,
				cardType: "basic",
			});
		}
	}

	return previews;
}

// ── Helpers ─────────────────────────────────────────────

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
