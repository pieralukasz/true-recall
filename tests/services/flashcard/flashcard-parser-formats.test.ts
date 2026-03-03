import { describe, it, expect } from "vitest";
import { FlashcardParserService } from "../../../src/features/study/services/flashcard/flashcard-parser.service";

describe("FlashcardParserService — :: inline format", () => {
	const parser = new FlashcardParserService();

	it("parses single inline card", () => {
		const content = `Photosynthesis::The process by which plants convert light into energy`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("Photosynthesis");
		expect(cards[0]!.answer).toBe(
			"The process by which plants convert light into energy",
		);
	});

	it("parses multiple inline cards", () => {
		const content = `Photosynthesis::Plant energy conversion
Mitosis::Cell division
ATP::Adenosine triphosphate`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(3);
		expect(cards[2]!.question).toBe("ATP");
		expect(cards[2]!.answer).toBe("Adenosine triphosphate");
	});

	it("skips empty lines", () => {
		const content = `Photosynthesis::Plant energy conversion

ATP::Adenosine triphosphate`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(2);
	});

	it("separates cloze :: from separator ::", () => {
		const content = `{{c1::photosynthesis}}::The process plants use`;

		const cards = parser.extractFlashcards(content);
		// The :: after }} is the separator; question has cloze → cloze card
		expect(cards).toHaveLength(1);
		expect(cards[0]!.cardType).toBe("cloze");
		expect(cards[0]!.clozeTemplate).toBe("{{c1::photosynthesis}}");
		expect(cards[0]!.answer).toContain("The process plants use");
	});

	it("skips lines without :: separator", () => {
		const content = `This is just a regular line
Photosynthesis::Plant energy conversion
Another regular line`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("Photosynthesis");
	});

	it("returns empty for lines without any separator", () => {
		const content = `Just text without separators`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(0);
	});

	it("handles whitespace around ::", () => {
		const content = `  Question  ::  Answer  `;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("Question");
		expect(cards[0]!.answer).toBe("Answer");
	});

	it("detects cloze in question side of :: card", () => {
		const content = `{{c1::Mitochondria}} is the powerhouse :: Extra info`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.cardType).toBe("cloze");
		expect(cards[0]!.clozeTemplate).toBe(
			"{{c1::Mitochondria}} is the powerhouse",
		);
		expect(cards[0]!.answer).toContain("Extra info");
	});

	it("handles multiple cloze indices in :: card", () => {
		const content = `{{c1::Tokyo}} is in {{c2::Japan}} :: Geography`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(2);
		expect(cards[0]!.cardType).toBe("cloze");
		expect(cards[0]!.clozeIndex).toBe(1);
		expect(cards[1]!.clozeIndex).toBe(2);
		expect(cards[0]!.clozeTemplate).toBe(
			"{{c1::Tokyo}} is in {{c2::Japan}}",
		);
	});

	it("handles cloze with hint syntax in :: card", () => {
		const content = `{{c1::Tokyo::capital city}} is in Japan :: Geography`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.cardType).toBe("cloze");
	});

	it("isFlashcardLine detects :: lines", () => {
		expect(parser.isFlashcardLine("Question :: Answer")).toBe(true);
		expect(parser.isFlashcardLine("No separator here")).toBe(false);
		expect(parser.isFlashcardLine("  Q :: A  ")).toBe(true);
	});
});
