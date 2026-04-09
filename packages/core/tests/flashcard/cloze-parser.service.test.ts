import { describe, expect, it } from "vitest";

import {
	extractClozeIndices,
	hasClozeContent,
	parseClozeTemplate,
	renderClozeAnswer,
	renderClozeQuestion,
} from "../../src/flashcard/parsing/cloze-parser.service";

describe("cloze-parser.service", () => {
	describe("hasClozeContent", () => {
		it("detects cloze syntax", () => {
			expect(hasClozeContent("{{c1::text}}")).toBe(true);
		});

		it("returns false for plain text", () => {
			expect(hasClozeContent("no cloze here")).toBe(false);
		});

		it("returns false for incomplete syntax", () => {
			expect(hasClozeContent("{{c1::}}")).toBe(true);
			expect(hasClozeContent("{{c1text}}")).toBe(false);
			expect(hasClozeContent("{c1::text}")).toBe(false);
		});
	});

	describe("extractClozeIndices", () => {
		it("extracts single index", () => {
			expect(extractClozeIndices("{{c1::text}}")).toEqual([1]);
		});

		it("extracts multiple indices sorted", () => {
			expect(extractClozeIndices("{{c2::b}} and {{c1::a}}")).toEqual([1, 2]);
		});

		it("deduplicates same index", () => {
			expect(extractClozeIndices("{{c1::a}} and {{c1::b}}")).toEqual([1]);
		});

		it("handles hints", () => {
			expect(extractClozeIndices("{{c1::answer::hint}}")).toEqual([1]);
		});

		it("returns empty for no cloze", () => {
			expect(extractClozeIndices("plain text")).toEqual([]);
		});
	});

	describe("renderClozeQuestion", () => {
		it("hides target cloze with [...]", () => {
			expect(renderClozeQuestion("{{c1::Tokyo}} is the capital", 1)).toBe(
				"[...] is the capital",
			);
		});

		it("uses hint when provided", () => {
			expect(renderClozeQuestion("{{c1::Tokyo::city}} is the capital", 1)).toBe(
				"[city] is the capital",
			);
		});

		it("reveals non-target clozes", () => {
			const template = "{{c1::Tokyo}} is the capital of {{c2::Japan}}";
			expect(renderClozeQuestion(template, 1)).toBe(
				"[...] is the capital of Japan",
			);
			expect(renderClozeQuestion(template, 2)).toBe(
				"Tokyo is the capital of [...]",
			);
		});

		it("hides all occurrences of same index", () => {
			expect(
				renderClozeQuestion("{{c1::Paris}} and {{c1::London}} are cities", 1),
			).toBe("[...] and [...] are cities");
		});
	});

	describe("renderClozeAnswer", () => {
		it("shows target cloze bold", () => {
			expect(renderClozeAnswer("{{c1::Tokyo}} is the capital", 1)).toBe(
				"**Tokyo** is the capital",
			);
		});

		it("reveals non-target clozes normally", () => {
			const template = "{{c1::Tokyo}} is the capital of {{c2::Japan}}";
			expect(renderClozeAnswer(template, 1)).toBe(
				"**Tokyo** is the capital of Japan",
			);
			expect(renderClozeAnswer(template, 2)).toBe(
				"Tokyo is the capital of **Japan**",
			);
		});

		it("bolds all occurrences of same index", () => {
			expect(
				renderClozeAnswer("{{c1::Paris}} and {{c1::London}} are cities", 1),
			).toBe("**Paris** and **London** are cities");
		});
	});

	describe("parseClozeTemplate", () => {
		it("generates one card per unique index", () => {
			const cards = parseClozeTemplate(
				"{{c1::Tokyo}} is the capital of {{c2::Japan}}",
			);
			expect(cards).toHaveLength(2);
			expect(cards[0]!.clozeIndex).toBe(1);
			expect(cards[0]!.question).toBe("[...] is the capital of Japan");
			expect(cards[0]!.answer).toBe("**Tokyo** is the capital of Japan");
			expect(cards[1]!.clozeIndex).toBe(2);
			expect(cards[1]!.question).toBe("Tokyo is the capital of [...]");
			expect(cards[1]!.answer).toBe("Tokyo is the capital of **Japan**");
		});

		it("handles single cloze", () => {
			const cards = parseClozeTemplate(
				"Mitochondria is the {{c1::powerhouse}} of the cell",
			);
			expect(cards).toHaveLength(1);
			expect(cards[0]!.question).toBe("Mitochondria is the [...] of the cell");
			expect(cards[0]!.answer).toBe(
				"Mitochondria is the **powerhouse** of the cell",
			);
		});

		it("handles multiple occurrences of same index", () => {
			const cards = parseClozeTemplate(
				"{{c1::H2O}} is also known as {{c1::water}}",
			);
			expect(cards).toHaveLength(1);
			expect(cards[0]!.question).toBe("[...] is also known as [...]");
			expect(cards[0]!.answer).toBe("**H2O** is also known as **water**");
		});

		it("handles cloze with hints", () => {
			const cards = parseClozeTemplate(
				"{{c1::Tokyo::capital city}} is in {{c2::Japan::country}}",
			);
			expect(cards).toHaveLength(2);
			expect(cards[0]!.question).toBe("[capital city] is in Japan");
			expect(cards[1]!.question).toBe("Tokyo is in [country]");
		});

		it("returns empty for no cloze content", () => {
			expect(parseClozeTemplate("just plain text")).toEqual([]);
		});

		it("handles three indices", () => {
			const cards = parseClozeTemplate("{{c1::A}} {{c2::B}} {{c3::C}}");
			expect(cards).toHaveLength(3);
			expect(cards[0]!.question).toBe("[...] B C");
			expect(cards[1]!.question).toBe("A [...] C");
			expect(cards[2]!.question).toBe("A B [...]");
		});
	});
});
