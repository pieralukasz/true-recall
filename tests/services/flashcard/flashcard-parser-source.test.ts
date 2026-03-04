import { describe, it, expect } from "vitest";
import { FlashcardParserService } from "../../../src/features/study/services/flashcard/flashcard-parser.service";

describe("FlashcardParserService — sourceText", () => {
	const parser = new FlashcardParserService();

	it("does not extract sourceText (now handled by AI pipeline only)", () => {
		const content =
			"What is X? :: The answer\n<!-- source: Some source text -->";
		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("What is X?");
		expect(cards[0]!.answer).toBe("The answer");
		expect(cards[0]!.sourceText).toBeUndefined();
	});

	it("ignores source comments on non-card lines", () => {
		const content = "<!-- source: Orphaned source comment -->";
		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(0);
	});
});
