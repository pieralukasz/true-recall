import { FLASHCARD_CONFIG } from "../../../../shared/constants";
import type { CardType } from "../../../../shared/types/fsrs/card.types";
import { parseClozeTemplate, renderClozeAnswer } from "./cloze-parser.service";

const CLOZE_DETECT = /\{\{c\d+::[^}]*?(?:::[^}]*?)?\}\}/;

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
 * Convert a single card (any type) to editable markdown format.
 *
 * - basic/undefined → "Q #flashcard\nA"
 * - cloze → "template #flashcard\nextraAnswer" (uses clozeTemplate, not rendered Q/A)
 * - reversed → "Q #flashcard-reverse\nA" (the original card's Q/A)
 */
export function cardToMarkdown(card: CardLike): string {
	const { tag, reverseTag } = FLASHCARD_CONFIG;

	if (card.cardType === "cloze" && card.clozeTemplate) {
		const extra = extractClozeExtraAnswer(card);
		const questionLine = `${card.clozeTemplate} ${tag}`;
		return extra ? `${questionLine}\n${extra}` : questionLine;
	}

	if (card.cardType === "reversed") {
		return card.question
			? `${card.answer} ${reverseTag}\n${card.question}`
			: `${card.answer} ${reverseTag}`;
	}

	return card.answer
		? `${card.question} ${tag}\n${card.answer}`
		: `${card.question} ${tag}`;
}

/**
 * Convert multiple cards to markdown, handling groups intelligently:
 * - Cloze siblings (same template) → deduplicated to one markdown block
 * - Reverse pairs (original + reversed) → deduplicated to one #flashcard-reverse block
 * - Blocks separated by \n\n
 */
export function cardsToMarkdown(cards: CardLike[]): string {
	if (cards.length === 0) return "";

	const { tag, reverseTag } = FLASHCARD_CONFIG;
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
				const questionLine = `${card.clozeTemplate} ${tag}`;
				blocks.push(extra ? `${questionLine}\n${extra}` : questionLine);
			}
			continue;
		}

		if (card.cardType === "reversed" && card.reverseOfBatchId) {
			continue;
		}

		const reversed = reverseByOriginal.get(cardId(card));
		if (reversed && !emittedReversePairs.has(cardId(card))) {
			emittedReversePairs.add(cardId(card));
			const block = card.answer
				? `${card.question} ${reverseTag}\n${card.answer}`
				: `${card.question} ${reverseTag}`;
			blocks.push(block);
			continue;
		}

		const block = card.answer
			? `${card.question} ${tag}\n${card.answer}`
			: `${card.question} ${tag}`;
		blocks.push(block);
	}

	return blocks.join("\n\n");
}

// ── Preview ─────────────────────────────────────────────

/**
 * Parse input text and generate structured preview of all cards that would be created.
 * Uses the same parsing logic as FlashcardParserService.
 */
export function previewCards(content: string): CardPreview[] {
	if (!content.trim()) return [];

	const previews: CardPreview[] = [];
	const tagPattern = new RegExp(
		`^(.*)\\s*(${FLASHCARD_CONFIG.reverseTag}|${FLASHCARD_CONFIG.tag})\\s*$`,
	);
	const codeBlockPattern = /^\s*(```|~~~)/;
	const lines = content.split("\n");

	let questionLines: string[] = [];
	let inQuestionCodeBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const trimmedLine = line.trim();

		if (codeBlockPattern.test(line)) {
			inQuestionCodeBlock = !inQuestionCodeBlock;
		}

		const tagMatch = line.match(tagPattern);

		if (tagMatch) {
			const beforeTag = tagMatch[1] ?? "";
			const matchedTag = tagMatch[2] ?? "";
			questionLines.push(beforeTag);

			const question = questionLines.join("\n").trim();
			questionLines = [];
			inQuestionCodeBlock = false;

			if (!question) continue;

			const isReverse = matchedTag === FLASHCARD_CONFIG.reverseTag;

			const answerLines: string[] = [];
			let inAnswerCodeBlock = false;
			i++;
			while (i < lines.length && (lines[i] ?? "").trim() === "") i++;

			while (i < lines.length) {
				const answerLine = lines[i] ?? "";
				if (/^ID:\s*\d+/.test(answerLine)) {
					i++;
					continue;
				}
				if (codeBlockPattern.test(answerLine))
					inAnswerCodeBlock = !inAnswerCodeBlock;
				if (
					(answerLine.trim() === "" && !inAnswerCodeBlock) ||
					tagPattern.test(answerLine)
				) {
					i--;
					break;
				}
				answerLines.push(answerLine);
				i++;
			}

			const answer = answerLines.join("\n").trim();

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
					label: isReverse ? "Original" : "Basic",
					question,
					answer,
					cardType: "basic",
				});

				if (isReverse && answer) {
					previews.push({
						label: "Reversed",
						question: answer,
						answer: question,
						cardType: "reversed",
					});
				}
			}
		} else if (trimmedLine === "" && !inQuestionCodeBlock) {
			questionLines = [];
		} else {
			questionLines.push(line);
		}
	}

	return previews;
}

// ── Helpers ─────────────────────────────────────────────

/**
 * Extract extra answer text from a cloze card.
 * Cloze answers are structured as: "rendered_answer\n\nextra_context"
 * This returns just the extra context, or "" if none.
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
