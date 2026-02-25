import {
	hasClozeContent,
	parseClozeTemplate,
} from "@features/study/services/flashcard/cloze-parser.service";
import { FLASHCARD_CONFIG } from "@shared/constants";
import type { FlashcardItem } from "@shared/types";

export interface IncrementalParseEvent {
	type: "card_complete" | "partial_update";
	cards?: FlashcardItem[];
	partialQuestion?: string;
	partialAnswer?: string;
}

type Phase = "question" | "answer" | "post_answer";

/**
 * Stateful incremental parser that processes streaming text chunks
 * and emits FlashcardItem objects as soon as each card is fully parsed.
 *
 * Card boundary: a card ends when the next #flashcard tag appears
 * on a new line, or at end-of-stream via finish().
 */
export class IncrementalFlashcardParser {
	private buffer = "";
	private processedLines: string[] = [];
	private phase: Phase = "question";
	private questionLines: string[] = [];
	private answerLines: string[] = [];
	private isReverse = false;
	private inCodeBlock = false;
	private skippingLeadingBlanks = false;

	private readonly tagPattern: RegExp;
	private readonly sourceCommentPattern = /^<!--\s*source:\s*(.*?)\s*-->$/i;
	private readonly codeBlockPattern = /^\s*(```|~~~)/;

	constructor() {
		this.tagPattern = new RegExp(
			`^(.*)\\s*(${FLASHCARD_CONFIG.reverseTag}|${FLASHCARD_CONFIG.tag})\\s*$`,
		);
	}

	feed(chunk: string): IncrementalParseEvent[] {
		this.buffer += chunk;
		return this.processBuffer(false);
	}

	finish(): IncrementalParseEvent[] {
		return this.processBuffer(true);
	}

	private processBuffer(isEnd: boolean): IncrementalParseEvent[] {
		const events: IncrementalParseEvent[] = [];

		// Split buffer into complete lines, keeping incomplete last line
		const parts = this.buffer.split("\n");
		if (isEnd) {
			// On finish, treat everything as complete lines
			this.processedLines.push(...parts);
			this.buffer = "";
		} else {
			// Keep the last (possibly incomplete) line in buffer
			this.buffer = parts.pop() ?? "";
			this.processedLines.push(...parts);
		}

		// Process all available complete lines
		while (this.processedLines.length > 0) {
			const line = this.processedLines.shift()!;
			const result = this.processLine(line);
			if (result) {
				events.push(result);
			}
		}

		// Finalize remaining card on stream end
		if (isEnd && this.questionLines.length > 0 && (this.phase === "answer" || this.phase === "post_answer")) {
			const cards = this.finalizeCurrentCard();
			if (cards.length > 0) {
				events.push({ type: "card_complete", cards });
			}
		}

		// Emit partial update if we have partial content
		if (!isEnd) {
			const partial = this.getPartialUpdate();
			if (partial) {
				events.push(partial);
			}
		}

		return events;
	}

	private processLine(line: string): IncrementalParseEvent | null {
		if (this.codeBlockPattern.test(line)) {
			this.inCodeBlock = !this.inCodeBlock;
		}

		const tagMatch = line.match(this.tagPattern);

		if (tagMatch && !this.inCodeBlock) {
			// Found a #flashcard tag
			const beforeTag = tagMatch[1] ?? "";
			const matchedTag = tagMatch[2] ?? "";

			if (this.phase === "answer" || this.phase === "post_answer") {
				// We were collecting an answer — finalize previous card
				const cards = this.finalizeCurrentCard();

				// Start new card with the part before the tag
				this.questionLines = [beforeTag];
				this.isReverse = matchedTag === FLASHCARD_CONFIG.reverseTag;
				this.phase = "answer";
				this.answerLines = [];
				this.inCodeBlock = false;
				this.skippingLeadingBlanks = true;

				const question = this.questionLines.join("\n").trim();
				if (!question) {
					this.phase = "question";
					this.questionLines = [];
				}

				if (cards.length > 0) {
					return { type: "card_complete", cards };
				}
				return null;
			}

			// We were accumulating question lines
			this.questionLines.push(beforeTag);
			const question = this.questionLines.join("\n").trim();

			if (!question) {
				this.questionLines = [];
				return null;
			}

			this.isReverse = matchedTag === FLASHCARD_CONFIG.reverseTag;
			this.phase = "answer";
			this.answerLines = [];
			this.inCodeBlock = false;
			this.skippingLeadingBlanks = true;
			return null;
		}

		if (this.phase === "question") {
			const trimmed = line.trim();
			if (trimmed === "" && !this.inCodeBlock) {
				// Empty line resets question accumulation
				this.questionLines = [];
			} else {
				this.questionLines.push(line);
			}
			return null;
		}

		if (this.phase === "answer") {
			// Skip leading empty lines after tag
			if (this.skippingLeadingBlanks) {
				if (line.trim() === "") return null;
				this.skippingLeadingBlanks = false;
			}

			// Skip legacy ID lines
			if (/^ID:\s*\d+/.test(line)) return null;

			// Check for source comment — part of answer but will be extracted
			const sourceMatch = line.trim().match(this.sourceCommentPattern);
			if (sourceMatch) {
				this.answerLines.push(line);
				return null;
			}

			// Empty line outside code block ends answer, enters post-answer phase
			if (line.trim() === "" && !this.inCodeBlock) {
				this.phase = "post_answer";
				return null;
			}

			this.answerLines.push(line);
			return null;
		}

		if (this.phase === "post_answer") {
			// After empty line: check if this is a source comment
			const sourceMatch = line.trim().match(this.sourceCommentPattern);
			if (sourceMatch) {
				this.answerLines.push(line);
				return null;
			}

			// Another empty line — still in post_answer
			if (line.trim() === "") return null;

			// Non-empty, non-source line — finalize card and start fresh
			const cards = this.finalizeCurrentCard();

			// This line is the start of a new question
			this.questionLines = [line];
			this.phase = "question";

			if (cards.length > 0) {
				return { type: "card_complete", cards };
			}
			return null;
		}

		return null;
	}

	private finalizeCurrentCard(): FlashcardItem[] {
		const question = this.questionLines.join("\n").trim();
		if (!question) {
			this.resetCardState();
			return [];
		}

		// Extract source comment from answer lines (scan backward)
		let sourceText: string | undefined;
		for (let j = this.answerLines.length - 1; j >= 0; j--) {
			const match = this.answerLines[j]
				?.trim()
				.match(this.sourceCommentPattern);
			if (match) {
				sourceText = match[1]?.trim() || undefined;
				this.answerLines.splice(j, 1);
				break;
			}
		}

		const answer = this.answerLines.join("\n").trim();
		const cards: FlashcardItem[] = [];

		if (hasClozeContent(question)) {
			const clozeCards = parseClozeTemplate(question);
			for (const cloze of clozeCards) {
				const fullAnswer = answer
					? `${cloze.answer}\n\n${answer}`
					: cloze.answer;
				cards.push({
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
			const basicId = crypto.randomUUID();
			cards.push({
				question,
				answer,
				id: basicId,
				sourceText,
			});

			if (this.isReverse && answer) {
				cards.push({
					question: answer,
					answer: question,
					id: crypto.randomUUID(),
					cardType: "reversed",
					reverseOfBatchId: basicId,
					sourceText,
				});
			}
		}

		this.resetCardState();
		return cards;
	}

	private resetCardState(): void {
		this.questionLines = [];
		this.answerLines = [];
		this.isReverse = false;
		this.phase = "question";
		this.inCodeBlock = false;
		this.skippingLeadingBlanks = false;
	}

	private getPartialUpdate(): IncrementalParseEvent | null {
		if (this.phase === "question" && this.questionLines.length > 0) {
			const lines = [...this.questionLines];
			if (this.buffer) lines.push(this.buffer);
			return {
				type: "partial_update",
				partialQuestion: lines.join("\n").trim() || undefined,
				partialAnswer: undefined,
			};
		}

		if (
			this.phase === "answer" ||
			this.phase === "post_answer"
		) {
			const question = this.questionLines.join("\n").trim();
			const answerSoFar = [...this.answerLines];
			if (this.buffer && this.phase === "answer") {
				answerSoFar.push(this.buffer);
			}
			return {
				type: "partial_update",
				partialQuestion: question || undefined,
				partialAnswer: answerSoFar.join("\n").trim() || undefined,
			};
		}

		return null;
	}
}
