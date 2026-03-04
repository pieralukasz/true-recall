import {
	hasClozeContent,
	parseClozeTemplate,
} from "@features/study/services/flashcard/cloze-parser.service";
import { INLINE_SEPARATOR_RE } from "@features/study/services/flashcard/parsing-patterns";
import type { FlashcardItem } from "@shared/types";

/**
 * Parse a single trimmed line into FlashcardItem(s).
 * Returns null if the line is not a flashcard.
 *
 * Handles two cases:
 * - `Front :: Back` with optional cloze in the question side
 * - Standalone cloze line (no :: outside braces) e.g. `{{c1::Tokyo}} is in Japan`
 */
export function parseFlashcardLine(trimmed: string): FlashcardItem[] | null {
	const match = trimmed.match(INLINE_SEPARATOR_RE);

	if (match) {
		const question = match[1]!.trim();
		const answer = match[2]!.trim();
		if (!question || !answer) return null;

		if (hasClozeContent(question)) {
			return parseClozeTemplate(question).map((cloze) => ({
				question: cloze.question,
				answer: answer ? `${cloze.answer}\n\n${answer}` : cloze.answer,
				id: crypto.randomUUID(),
				cardType: "cloze" as const,
				clozeTemplate: question,
				clozeIndex: cloze.clozeIndex,
			}));
		}

		return [{ id: crypto.randomUUID(), question, answer }];
	}

	// Standalone cloze line without a top-level :: separator
	// e.g. "{{c1::Tokyo}} is in {{c2::Japan}}" — no extra answer
	if (hasClozeContent(trimmed)) {
		return parseClozeTemplate(trimmed).map((cloze) => ({
			question: cloze.question,
			answer: cloze.answer,
			id: crypto.randomUUID(),
			cardType: "cloze" as const,
			clozeTemplate: trimmed,
			clozeIndex: cloze.clozeIndex,
		}));
	}

	return null;
}

export class FlashcardParserService {
	extractFlashcards(content: string): FlashcardItem[] {
		const flashcards: FlashcardItem[] = [];

		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			const parsed = parseFlashcardLine(trimmed);
			if (parsed) flashcards.push(...parsed);
		}

		return flashcards;
	}
}
