/**
 * Scans for `Front :: Back` lines (:: separator not inside cloze braces)
 * and standalone cloze lines. Supports cloze deletion syntax: {{c1::text}} and {{c1::text::hint}}.
 */

import { parseFlashcardLine } from "@features/study/services/flashcard/flashcard-parser.service";
import type { FlashcardItem } from "@shared/types";

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
			const parsed = trimmed ? parseFlashcardLine(trimmed) : null;

			if (parsed) {
				flashcards.push(...parsed);
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

	countFlashcardLines(content: string): number {
		let count = 0;
		for (const line of content.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (trimmed && parseFlashcardLine(trimmed)) count++;
		}
		return count;
	}
}
