/**
 * Collect Service
 * Handles collecting flashcards from markdown and optionally removing them.
 *
 * Scans for `Front :: Back` lines (:: separator not inside cloze braces).
 * Supports cloze deletion syntax: {{c1::text}} and {{c1::text::hint}}.
 */

import {
	hasClozeContent,
	parseClozeTemplate,
} from "@features/study/services/flashcard/cloze-parser.service";
import type { FlashcardItem } from "@shared/types";

// :: separator for inline cards (not inside cloze {{c1::text}})
const INLINE_SEPARATOR_RE = /^(.+?)(?<!{[^}]*)::(?![^{]*}})(.+)$/;

export interface CollectResult {
	collectedCount: number;
	flashcards: FlashcardItem[];
	/** Original content unchanged (:: format has no separate tag to strip) */
	newContent: string;
	/** Content with :: flashcard lines removed */
	newContentWithoutFlashcards: string;
}

export class CollectService {
	collect(content: string): CollectResult {
		const lines = content.split(/\r?\n/);
		const flashcards: FlashcardItem[] = [];
		const noFlashcardsLines: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			const match = trimmed.match(INLINE_SEPARATOR_RE);

			if (match) {
				const question = match[1]!.trim();
				const answer = match[2]!.trim();
				if (question && answer) {
					this.saveFlashcard(flashcards, question, answer);
				} else {
					noFlashcardsLines.push(line);
				}
			} else {
				noFlashcardsLines.push(line);
			}
		}

		return {
			collectedCount: flashcards.length,
			flashcards,
			newContent: content,
			newContentWithoutFlashcards: noFlashcardsLines.join("\n"),
		};
	}

	private saveFlashcard(
		flashcards: FlashcardItem[],
		question: string,
		answer: string,
	): void {
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
				});
			}
			return;
		}

		flashcards.push({
			question,
			answer,
			id: crypto.randomUUID(),
		});
	}

	hasFlashcardLines(content: string): boolean {
		const lines = content.split(/\r?\n/);
		return lines.some((line) => INLINE_SEPARATOR_RE.test(line.trim()));
	}

	countFlashcardLines(content: string): number {
		const lines = content.split(/\r?\n/);
		let count = 0;
		for (const line of lines) {
			if (INLINE_SEPARATOR_RE.test(line.trim())) count++;
		}
		return count;
	}
}
