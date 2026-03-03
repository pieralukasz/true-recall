import {
	hasClozeContent,
	parseClozeTemplate,
} from "@features/study/services/flashcard/cloze-parser.service";
import type { FlashcardItem } from "@shared/types";

// :: separator for inline cards (not inside cloze {{c1::text}})
const INLINE_SEPARATOR_RE = /^(.+?)(?<!{[^}]*)::(?![^{]*}})(.+)$/;

export class FlashcardParserService {
	extractFlashcards(content: string): FlashcardItem[] {
		const lines = content.split("\n");
		const flashcards: FlashcardItem[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			const match = trimmed.match(INLINE_SEPARATOR_RE);
			if (!match) continue;

			const question = match[1]!.trim();
			const answer = match[2]!.trim();
			if (!question || !answer) continue;

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
			} else {
				flashcards.push({
					id: crypto.randomUUID(),
					question,
					answer,
				});
			}
		}

		return flashcards;
	}

	isFlashcardLine(line: string): boolean {
		return INLINE_SEPARATOR_RE.test(line.trim());
	}
}
