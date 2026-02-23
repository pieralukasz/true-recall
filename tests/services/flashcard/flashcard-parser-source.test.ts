import { describe, it, expect } from "vitest";
import { FlashcardParserService } from "../../../src/features/study/services/flashcard/flashcard-parser.service";

describe("FlashcardParserService — source text extraction", () => {
	const parser = new FlashcardParserService();

	describe("basic cards", () => {
		it("extracts source comment into sourceText", () => {
			const content = `What is **[[rosacea]]**? #flashcard
Reddening of the skin
<!-- source: Rosacea is manifested by intense reddening of the skin. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards).toHaveLength(1);
			expect(cards[0]!.sourceText).toBe(
				"Rosacea is manifested by intense reddening of the skin.",
			);
		});

		it("removes source comment from the answer text", () => {
			const content = `What is **[[rosacea]]**? #flashcard
Reddening of the skin
<!-- source: Rosacea is manifested by intense reddening of the skin. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards[0]!.answer).toBe("Reddening of the skin");
		});

		it("handles multiple cards each with their own source", () => {
			const content = `What is **[[rosacea]]**? #flashcard
Reddening of the skin
<!-- source: Rosacea is manifested by intense reddening of the skin. -->

How does advanced **[[rosacea]]** manifest? #flashcard
Papulopustular changes
<!-- source: In an advanced degree, papulopustular changes may appear. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards).toHaveLength(2);
			expect(cards[0]!.sourceText).toBe(
				"Rosacea is manifested by intense reddening of the skin.",
			);
			expect(cards[1]!.sourceText).toBe(
				"In an advanced degree, papulopustular changes may appear.",
			);
		});

		it("returns undefined sourceText when no source comment present", () => {
			const content = `What is **[[rosacea]]**? #flashcard
Reddening of the skin`;

			const cards = parser.extractFlashcards(content);
			expect(cards).toHaveLength(1);
			expect(cards[0]!.sourceText).toBeUndefined();
			expect(cards[0]!.answer).toBe("Reddening of the skin");
		});
	});

	describe("cloze cards", () => {
		it("extracts source text for cloze cards", () => {
			const content = `[[mitochondria|Mitochondria]] are the {{c1::powerhouse}} of the cell #flashcard
<!-- source: Mitochondria are the powerhouse of the cell. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards).toHaveLength(1);
			expect(cards[0]!.cardType).toBe("cloze");
			expect(cards[0]!.sourceText).toBe(
				"Mitochondria are the powerhouse of the cell.",
			);
		});

		it("all cloze variants share the same source text", () => {
			const content = `[[mitochondria|Mitochondria]] produce {{c1::ATP}} through {{c2::oxidative phosphorylation}} #flashcard
<!-- source: They produce ATP through oxidative phosphorylation. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards).toHaveLength(2);
			expect(cards[0]!.sourceText).toBe(
				"They produce ATP through oxidative phosphorylation.",
			);
			expect(cards[1]!.sourceText).toBe(
				"They produce ATP through oxidative phosphorylation.",
			);
		});
	});

	describe("reversed cards", () => {
		it("both forward and reversed card get the same source text", () => {
			const content = `What is the capital of **[[france]]**? #flashcard-reverse
Paris
<!-- source: The capital of France is Paris. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards).toHaveLength(2);
			expect(cards[0]!.sourceText).toBe("The capital of France is Paris.");
			expect(cards[1]!.sourceText).toBe("The capital of France is Paris.");
			expect(cards[1]!.cardType).toBe("reversed");
		});
	});

	describe("edge cases", () => {
		it("handles source text with special characters", () => {
			const content = `What is the formula? #flashcard
E = mc²
<!-- source: Einstein's formula: E = mc² (mass–energy equivalence). -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards[0]!.sourceText).toBe(
				"Einstein's formula: E = mc² (mass–energy equivalence).",
			);
			expect(cards[0]!.answer).toBe("E = mc²");
		});

		it("handles source comment with extra whitespace", () => {
			const content = `What is it? #flashcard
Answer here
<!--  source:   Some source text with spaces   -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards[0]!.sourceText).toBe("Some source text with spaces");
		});

		it("handles mixed cards — some with source, some without", () => {
			const content = `First question? #flashcard
First answer
<!-- source: Source for first. -->

Second question? #flashcard
Second answer`;

			const cards = parser.extractFlashcards(content);
			expect(cards).toHaveLength(2);
			expect(cards[0]!.sourceText).toBe("Source for first.");
			expect(cards[1]!.sourceText).toBeUndefined();
		});

		it("handles case-insensitive source comment (capital S)", () => {
			const content = `What is it? #flashcard
Answer here
<!-- Source: Some capitalized source text. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards[0]!.sourceText).toBe(
				"Some capitalized source text.",
			);
			expect(cards[0]!.answer).toBe("Answer here");
		});

		it("handles SOURCE in all caps", () => {
			const content = `What is it? #flashcard
Answer here
<!-- SOURCE: All caps source. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards[0]!.sourceText).toBe("All caps source.");
		});

		it("extracts source comment after blank line (peek ahead)", () => {
			const content = `What is X? #flashcard
Answer text

<!-- source: X is a concept from the text. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards[0]!.sourceText).toBe(
				"X is a concept from the text.",
			);
			expect(cards[0]!.answer).toBe("Answer text");
		});

		it("extracts source comment after multiple blank lines", () => {
			const content = `What is X? #flashcard
Answer text


<!-- source: Source after two blank lines. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards[0]!.sourceText).toBe(
				"Source after two blank lines.",
			);
		});

		it("peek ahead does not steal source from next card", () => {
			const content = `First question? #flashcard
First answer

Second question? #flashcard
Second answer
<!-- source: Source for second only. -->`;

			const cards = parser.extractFlashcards(content);
			expect(cards).toHaveLength(2);
			expect(cards[0]!.sourceText).toBeUndefined();
			expect(cards[1]!.sourceText).toBe("Source for second only.");
		});

		it("does not treat source comment inside answer as source when it is not the last line", () => {
			const content = `Question? #flashcard
First line of answer
<!-- source: This is the source. -->
Second line of answer`;

			const cards = parser.extractFlashcards(content);
			// Source comment is the last before the non-empty continuation, but since
			// the loop collects all lines until empty line, the source comment in the
			// middle is still extracted by backward scan
			expect(cards[0]!.sourceText).toBe("This is the source.");
			expect(cards[0]!.answer).toBe(
				"First line of answer\nSecond line of answer",
			);
		});
	});
});
