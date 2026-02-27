/**
 * Flashcard Parser Service
 * Handles parsing and extracting flashcards from markdown content
 *
 * Supports multi-line questions including code blocks:
 * ```
 * Question text
 * ```typescript
 * code example
 * ``` #flashcard
 * Answer text
 * ```
 *
 * Also supports:
 * - Cloze deletions: {{c1::text}} and {{c1::text::hint}}
 * - Reversed cards via #flashcard-reverse tag
 * - Q:/A: format (fallback when no #flashcard tags present)
 * - :: inline format (fallback when no #flashcard tags or Q:/A: found)
 */

import {
	hasClozeContent,
	parseClozeTemplate,
} from "@features/study/services/flashcard/cloze-parser.service";
import { FLASHCARD_CONFIG } from "@shared/constants";
import type { FlashcardItem } from "@shared/types";

// Q: or Q : at line start (case-insensitive)
const QA_QUESTION_RE = /^Q\s*:\s*(.+)/i;
const QA_ANSWER_RE = /^A\s*:\s*(.*)/i;

// :: separator for inline cards (not inside cloze {{c1::text}})
const INLINE_SEPARATOR_RE = /^(.+?)(?<!{[^}]*)::(?![^{]*}})(.+)$/;

export class FlashcardParserService {
	private codeBlockPattern: RegExp = /^\s*(```|~~~)/;
	private tagPattern: RegExp;
	private sourceCommentPattern: RegExp = /^<!--\s*source:\s*(.*?)\s*-->$/i;

	constructor() {
		// Matches line ending with #flashcard-reverse or #flashcard
		// Captures: [1] text before tag, [2] the matched tag
		this.tagPattern = new RegExp(
			`^(.*)\\s*(${FLASHCARD_CONFIG.reverseTag}|${FLASHCARD_CONFIG.tag})\\s*$`,
		);
	}

	/**
	 * Parsing priority:
	 * 1. #flashcard / #flashcard-reverse tags → tag-based parser (original)
	 * 2. Q:/A: lines → QA parser (fallback)
	 * 3. :: inline separator → inline parser (fallback)
	 */
	extractFlashcards(content: string): FlashcardItem[] {
		// tagPattern was built for per-line matching; check with includes() for speed
		if (
			content.includes(FLASHCARD_CONFIG.tag) ||
			content.includes(FLASHCARD_CONFIG.reverseTag)
		) {
			return this.extractTagBased(content);
		}

		// Fallback: try Q:/A: format
		const qaCards = this.extractQAFormat(content);
		if (qaCards.length > 0) return qaCards;

		// Fallback: try :: inline format
		return this.extractInlineFormat(content);
	}

	private extractTagBased(content: string): FlashcardItem[] {
		const flashcards: FlashcardItem[] = [];
		const lines = content.split("\n");

		let questionLines: string[] = [];
		let inQuestionCodeBlock = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const trimmedLine = line.trim();

			// Toggle code block state for question accumulation
			if (this.codeBlockPattern.test(line)) {
				inQuestionCodeBlock = !inQuestionCodeBlock;
			}

			const tagMatch = line.match(this.tagPattern);

			if (tagMatch) {
				// Found #flashcard or #flashcard-reverse
				const beforeTag = tagMatch[1] ?? "";
				const matchedTag = tagMatch[2] ?? "";

				// Add the part before tag to question lines
				questionLines.push(beforeTag);

				const question = questionLines.join("\n").trim();
				questionLines = [];
				inQuestionCodeBlock = false;

				if (!question) {
					continue; // Skip if no question content
				}

				const isReverse = matchedTag === FLASHCARD_CONFIG.reverseTag;

				// Collect answer
				const answerLines: string[] = [];
				let inAnswerCodeBlock = false;

				i++;
				// Skip leading empty lines between question and answer
				while (i < lines.length && (lines[i] ?? "").trim() === "") {
					i++;
				}

				while (i < lines.length) {
					const answerLine = lines[i] ?? "";

					// Skip legacy ID lines
					if (/^ID:\s*\d+/.test(answerLine)) {
						i++;
						continue;
					}

					// Toggle code block state for answer
					if (this.codeBlockPattern.test(answerLine)) {
						inAnswerCodeBlock = !inAnswerCodeBlock;
					}

					// Check for end of answer:
					// - Empty line outside code block
					// - Next #flashcard tag
					if (
						(answerLine.trim() === "" && !inAnswerCodeBlock) ||
						this.tagPattern.test(answerLine)
					) {
						i--;
						break;
					}

					answerLines.push(answerLine);
					i++;
				}

				// Extract <!-- source: ... --> from answer lines (scan backward)
				let sourceText: string | undefined;
				for (let j = answerLines.length - 1; j >= 0; j--) {
					const sourceMatch = answerLines[j]
						?.trim()
						.match(this.sourceCommentPattern);
					if (sourceMatch) {
						sourceText = sourceMatch[1]?.trim() || undefined;
						answerLines.splice(j, 1);
						break;
					}
				}

				// AI sometimes puts a blank line before the source comment,
				// which causes the answer loop to stop before reaching it.
				// Peek ahead past blank lines to catch it.
				if (!sourceText) {
					let peek = i + 1;
					while (
						peek < lines.length &&
						lines[peek]?.trim() === ""
					) {
						peek++;
					}
					const peekMatch = lines[peek]
						?.trim()
						.match(this.sourceCommentPattern);
					if (peekMatch) {
						sourceText = peekMatch[1]?.trim() || undefined;
					}
				}

				const answer = answerLines.join("\n").trim();

				// Handle cloze syntax
				if (hasClozeContent(question)) {
					const clozeCards = parseClozeTemplate(question);
					for (const cloze of clozeCards) {
						const fullAnswer = answer
							? `${cloze.answer}\n\n${answer}`
							: cloze.answer;
						flashcards.push({
							question: cloze.question,
							answer: fullAnswer,
							id: crypto.randomUUID(),
							cardType: "cloze",
							clozeTemplate: question,
							clozeIndex: cloze.clozeIndex,
							sourceText,
						});
					}
				} else {
					// Basic card
					const basicId = crypto.randomUUID();
					flashcards.push({
						question,
						answer,
						id: basicId,
						sourceText,
					});

					// If #flashcard-reverse, also generate a reversed card
					if (isReverse && answer) {
						flashcards.push({
							question: answer,
							answer: question,
							id: crypto.randomUUID(),
							cardType: "reversed",
							reverseOfBatchId: basicId,
							sourceText,
						});
					}
				}
			} else if (trimmedLine === "" && !inQuestionCodeBlock) {
				// Empty line outside code block - reset question accumulation
				questionLines = [];
			} else {
				// Accumulate line as potential question content
				questionLines.push(line);
			}
		}

		return flashcards;
	}

	/**
	 * Check if a line is a flashcard question line (contains #flashcard tag)
	 */
	isFlashcardLine(line: string): boolean {
		return this.tagPattern.test(line);
	}

	/**
	 * Q:/A: format parser.
	 * Each card starts with "Q: question" and the answer follows on "A: answer".
	 * Multi-line answers collect until the next Q: or end of content.
	 */
	private extractQAFormat(content: string): FlashcardItem[] {
		const lines = content.split("\n");
		const flashcards: FlashcardItem[] = [];

		let currentQuestion: string | null = null;
		let answerLines: string[] = [];

		const flushCard = () => {
			if (!currentQuestion) return;
			const answer = answerLines.join("\n").trim();
			if (currentQuestion || answer) {
				flashcards.push({
					id: crypto.randomUUID(),
					question: currentQuestion,
					answer,
				});
			}
			currentQuestion = null;
			answerLines = [];
		};

		for (const line of lines) {
			const qMatch = line.match(QA_QUESTION_RE);
			if (qMatch) {
				flushCard();
				currentQuestion = qMatch[1]!.trim();
				continue;
			}

			const aMatch = line.match(QA_ANSWER_RE);
			if (aMatch && currentQuestion != null) {
				const text = aMatch[1]!.trim();
				if (text) answerLines.push(text);
				continue;
			}

			// Lines after A: are continuation of the answer
			if (currentQuestion != null && answerLines.length > 0) {
				answerLines.push(line);
			}
		}

		flushCard();
		return flashcards;
	}

	/**
	 * :: inline format parser.
	 * Each line with :: (not inside cloze braces) is one card.
	 * Left side = question, right side = answer.
	 */
	private extractInlineFormat(content: string): FlashcardItem[] {
		const lines = content.split("\n");
		const flashcards: FlashcardItem[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			const match = trimmed.match(INLINE_SEPARATOR_RE);
			if (match) {
				const question = match[1]!.trim();
				const answer = match[2]!.trim();
				if (question && answer) {
					flashcards.push({
						id: crypto.randomUUID(),
						question,
						answer,
					});
				}
			}
		}

		return flashcards;
	}

	/**
	 * Get the flashcard tag pattern for external use
	 */
	getFlashcardTag(): string {
		return FLASHCARD_CONFIG.tag;
	}
}
