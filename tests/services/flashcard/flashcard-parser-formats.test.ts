import { describe, it, expect } from "vitest";
import { FlashcardParserService } from "../../../src/features/study/services/flashcard/flashcard-parser.service";

describe("FlashcardParserService — Q:/A: format", () => {
	const parser = new FlashcardParserService();

	it("parses single Q:/A: card", () => {
		const content = `Q: What is photosynthesis?
A: The process by which plants convert light into energy`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("What is photosynthesis?");
		expect(cards[0]!.answer).toBe(
			"The process by which plants convert light into energy",
		);
	});

	it("parses multiple Q:/A: cards", () => {
		const content = `Q: What is photosynthesis?
A: The process by which plants convert light into energy

Q: What are the inputs?
A: Sunlight, water, and CO2`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(2);
		expect(cards[0]!.question).toBe("What is photosynthesis?");
		expect(cards[1]!.question).toBe("What are the inputs?");
		expect(cards[1]!.answer).toBe("Sunlight, water, and CO2");
	});

	it("handles multi-line answers", () => {
		const content = `Q: List the stages of mitosis
A: The four stages are:
- Prophase
- Metaphase
- Anaphase
- Telophase`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.answer).toBe(
			"The four stages are:\n- Prophase\n- Metaphase\n- Anaphase\n- Telophase",
		);
	});

	it("handles case-insensitive Q/A prefixes", () => {
		const content = `q: lowercase question?
a: lowercase answer`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("lowercase question?");
	});

	it("handles Q/A with extra spacing", () => {
		const content = `Q :  What is X?
A :  It is Y`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("What is X?");
		expect(cards[0]!.answer).toBe("It is Y");
	});

	it("returns empty array when no Q: lines found", () => {
		const content = `Just some random text
without any flashcard format`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(0);
	});

	it("prefers #flashcard format over Q:/A: when tags present", () => {
		const content = `What is X? #flashcard
It is Y

Q: This should be ignored
A: Because #flashcard tags take priority`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("What is X?");
		expect(cards[0]!.answer).toBe("It is Y");
	});

	it("handles Q: without a following A: (empty answer)", () => {
		const content = `Q: What is X?`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("What is X?");
		expect(cards[0]!.answer).toBe("");
	});

	it("handles consecutive Q: lines (second Q starts new card)", () => {
		const content = `Q: First question?
A: First answer
Q: Second question?
A: Second answer`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(2);
	});
});

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

	it("does not confuse cloze :: with separator", () => {
		const content = `{{c1::photosynthesis}}::The process plants use`;

		const cards = parser.extractFlashcards(content);
		// The cloze :: is inside braces, so the first :: outside braces is the separator
		expect(cards).toHaveLength(1);
		expect(cards[0]!.answer).toBe("The process plants use");
	});

	it("skips lines without :: separator", () => {
		const content = `This is just a regular line
Photosynthesis::Plant energy conversion
Another regular line`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("Photosynthesis");
	});

	it("prefers #flashcard format over :: when tags present", () => {
		const content = `What is X? #flashcard
It is Y`;

		const cards = parser.extractFlashcards(content);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("What is X?");
	});

	it("prefers Q:/A: format over :: when Q: lines present", () => {
		const content = `Q: What is X?
A: It is Y
Something::Else`;

		const cards = parser.extractFlashcards(content);
		// Q:/A: takes priority, so only the Q:/A: card is parsed
		expect(cards).toHaveLength(1);
		expect(cards[0]!.question).toBe("What is X?");
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
});
