import { describe, it, expect } from "vitest";
import { CollectService } from "../../../src/features/study/services/flashcard/collect.service";

describe("CollectService", () => {
	const service = new CollectService();

	describe("collect", () => {
		it("collects a single basic flashcard", () => {
			const result = service.collect("What is X? :: Definition");

			expect(result.collectedCount).toBe(1);
			expect(result.flashcards).toHaveLength(1);
			expect(result.flashcards[0]!.question).toBe("What is X?");
			expect(result.flashcards[0]!.answer).toBe("Definition");
		});

		it("collects multiple flashcards", () => {
			const content = "Q1 :: A1\nQ2 :: A2\nQ3 :: A3";
			const result = service.collect(content);

			expect(result.collectedCount).toBe(3);
			expect(result.flashcards).toHaveLength(3);
		});

		it("skips non-flashcard lines", () => {
			const content = "Some text\nQ :: A\nMore text";
			const result = service.collect(content);

			expect(result.collectedCount).toBe(1);
			expect(result.flashcards[0]!.question).toBe("Q");
		});

		it("returns empty for content without flashcards", () => {
			const result = service.collect("Just some text\nNo flashcards here");

			expect(result.collectedCount).toBe(0);
			expect(result.flashcards).toHaveLength(0);
		});

		it("returns empty for empty string", () => {
			const result = service.collect("");

			expect(result.collectedCount).toBe(0);
			expect(result.flashcards).toHaveLength(0);
		});

		it("returns empty for whitespace-only input", () => {
			const result = service.collect("   \n  \n  ");

			expect(result.collectedCount).toBe(0);
			expect(result.flashcards).toHaveLength(0);
		});

		it("collects cloze card with :: separator and extra", () => {
			const content =
				"{{c1::Tokyo}} is in {{c2::Japan}} :: Geography";
			const result = service.collect(content);

			expect(result.collectedCount).toBe(2);
			expect(result.flashcards[0]!.cardType).toBe("cloze");
			expect(result.flashcards[0]!.clozeIndex).toBe(1);
			expect(result.flashcards[1]!.clozeIndex).toBe(2);
			expect(result.flashcards[0]!.answer).toContain("Geography");
		});

		it("collects standalone cloze line (no :: separator)", () => {
			const content = "{{c1::Tokyo}} is in {{c2::Japan}}";
			const result = service.collect(content);

			expect(result.collectedCount).toBe(2);
			expect(result.flashcards[0]!.cardType).toBe("cloze");
			expect(result.flashcards[0]!.clozeTemplate).toBe(content);
		});

		it("does not collect malformed lines with empty question side", () => {
			const content = " :: Answer";
			const result = service.collect(content);

			expect(result.collectedCount).toBe(0);
		});

		it("does not collect malformed lines with empty answer side", () => {
			const content = "Question :: ";
			const result = service.collect(content);

			expect(result.collectedCount).toBe(0);
		});

		it("returns original content unchanged as newContent", () => {
			const content = "Some text\nQ :: A\nMore text";
			const result = service.collect(content);

			expect(result.newContent).toBe(content);
		});

		it("strips flashcard lines from newContentWithoutFlashcards", () => {
			const result = service.collect("Line 1\nQ :: A\nLine 3");

			expect(result.newContentWithoutFlashcards).toBe("Line 1\nLine 3");
		});

		it("strips standalone cloze from newContentWithoutFlashcards", () => {
			const result = service.collect(
				"Line 1\n{{c1::Tokyo}} is in Japan\nLine 3",
			);

			expect(result.newContentWithoutFlashcards).toBe("Line 1\nLine 3");
		});

		it("handles CRLF line endings", () => {
			const content = "Q1 :: A1\r\nQ2 :: A2";
			const result = service.collect(content);

			expect(result.collectedCount).toBe(2);
		});
	});

	describe("countFlashcardLines", () => {
		it("counts basic flashcard lines", () => {
			expect(service.countFlashcardLines("Q1 :: A1\nQ2 :: A2")).toBe(2);
		});

		it("counts standalone cloze lines", () => {
			expect(
				service.countFlashcardLines("{{c1::Tokyo}} is in Japan"),
			).toBe(1);
		});

		it("returns 0 for non-flashcard content", () => {
			expect(service.countFlashcardLines("Just text")).toBe(0);
		});

		it("returns 0 for empty input", () => {
			expect(service.countFlashcardLines("")).toBe(0);
		});

		it("does not count lines with empty question or answer", () => {
			expect(service.countFlashcardLines(" :: answer")).toBe(0);
			expect(service.countFlashcardLines("question :: ")).toBe(0);
		});

		it("matches collect behavior exactly", () => {
			const content = [
				"Q1 :: A1",
				"Regular text",
				"{{c1::Paris}} is nice",
				"{{c1::Tokyo}} :: Geography",
				" :: orphan",
			].join("\n");

			const count = service.countFlashcardLines(content);
			const collectResult = service.collect(content);

			// countFlashcardLines counts lines, not expanded cloze cards
			// Line "Q1 :: A1" = 1 line, "{{c1::Paris}} is nice" = 1 line, "{{c1::Tokyo}} :: Geography" = 1 line
			expect(count).toBe(3);

			// collect expands cloze: the standalone cloze and the :: cloze are each 1 cloze card
			// Total: 1 basic + 1 cloze (standalone) + 1 cloze (with extra) = 3 FlashcardItems
			expect(collectResult.collectedCount).toBe(3);
		});
	});
});
