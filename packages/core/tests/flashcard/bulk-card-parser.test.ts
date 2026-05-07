/**
 * Bulk Card Parser Tests
 *
 * Tests `Front :: Back` text → ParsedCard[] conversion for the Quick tab.
 */
import { describe, expect, it } from "vitest";

import { parseBulkText } from "../../src/flashcard/parsing/bulk-card-parser";
import { BUILTIN_BASIC_ID, BUILTIN_CLOZE_ID } from "../../src/types/note.types";

describe("BulkCardParser", () => {
	// ── Double-colon format ───────────────────────────────────

	describe("double-colon format", () => {
		it("parses single :: separated line", () => {
			const result = parseBulkText("What is ATP? :: Adenosine triphosphate");

			expect(result.detectedFormat).toBe("double-colon");
			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]?.fields).toEqual({
				Front: "What is ATP?",
				Back: "Adenosine triphosphate",
			});
		});

		it("parses multiple :: lines", () => {
			const input = [
				"Capital of France :: Paris",
				"Capital of Japan :: Tokyo",
			].join("\n");

			const result = parseBulkText(input);

			expect(result.detectedFormat).toBe("double-colon");
			expect(result.cards).toHaveLength(2);
		});

		it("does not split on :: inside cloze syntax", () => {
			const result = parseBulkText("{{c1::Paris}} is the capital of France");

			expect(result.detectedFormat).toBe("double-colon");
			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]?.fields.Text).toBe(
				"{{c1::Paris}} is the capital of France",
			);
		});

		it("trims whitespace around separator", () => {
			const result = parseBulkText("  Question  ::  Answer  ");

			expect(result.cards[0]?.fields).toEqual({
				Front: "Question",
				Back: "Answer",
			});
		});

		it("skips empty lines", () => {
			const input = "Q1 :: A1\n\nQ2 :: A2";
			const result = parseBulkText(input);

			expect(result.cards).toHaveLength(2);
		});
	});

	// ── Cloze detection ───────────────────────────────────────

	describe("cloze detection", () => {
		it("detects cloze in double-colon format", () => {
			const input = [
				"{{c1::Paris}} is the capital of France",
				"Normal question :: Normal answer",
			].join("\n");

			const result = parseBulkText(input);

			expect(result.cards).toHaveLength(2);

			const clozeCard = result.cards.find(
				(c) => c.noteTypeId === BUILTIN_CLOZE_ID,
			);
			expect(clozeCard).toBeDefined();
			expect(clozeCard?.fields.Text).toBe(
				"{{c1::Paris}} is the capital of France",
			);
			expect(clozeCard?.fields.Extra).toBe("");
		});

		it("detects cloze in :: separated card (front side has cloze)", () => {
			const input = "{{c1::Mitochondria}} is the powerhouse :: Extra info";
			const result = parseBulkText(input);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]?.fields.Text).toBe(
				"{{c1::Mitochondria}} is the powerhouse",
			);
			expect(result.cards[0]?.fields.Extra).toBe("Extra info");
		});

		it("detects cloze with hint syntax", () => {
			const result = parseBulkText("{{c1::Tokyo::capital city}} is in Japan");

			expect(result.cards[0]?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
		});

		it("detects multiple cloze indices in one line", () => {
			const result = parseBulkText(
				"{{c1::Paris}} is the capital of {{c2::France}}",
			);

			expect(result.cards[0]?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]?.fields.Text).toContain("{{c1::");
			expect(result.cards[0]?.fields.Text).toContain("{{c2::");
		});
	});

	// ── Mixed content ─────────────────────────────────────────

	describe("mixed content", () => {
		it("handles mix of basic and cloze cards", () => {
			const input = [
				"Normal question :: Normal answer",
				"{{c1::ATP}} stands for adenosine triphosphate",
				"Another question :: Another answer",
			].join("\n");

			const result = parseBulkText(input);

			expect(result.cards).toHaveLength(3);

			const basicCards = result.cards.filter(
				(c) => c.noteTypeId === BUILTIN_BASIC_ID,
			);
			const clozeCards = result.cards.filter(
				(c) => c.noteTypeId === BUILTIN_CLOZE_ID,
			);

			expect(basicCards).toHaveLength(2);
			expect(clozeCards).toHaveLength(1);
		});
	});

	// ── Edge cases ────────────────────────────────────────────

	describe("edge cases", () => {
		it("returns empty for empty input", () => {
			const result = parseBulkText("");

			expect(result.cards).toHaveLength(0);
			expect(result.detectedFormat).toBe("none");
		});

		it("returns empty for whitespace-only input", () => {
			const result = parseBulkText("   \n\n   ");

			expect(result.cards).toHaveLength(0);
			expect(result.detectedFormat).toBe("none");
		});

		it("returns empty for unrecognized format", () => {
			const result = parseBulkText("Just some random text\nwithout any format");

			expect(result.cards).toHaveLength(0);
			expect(result.detectedFormat).toBe("none");
		});
	});

	// ── Format detection accuracy ─────────────────────────────

	describe("format detection", () => {
		it("detects double-colon format", () => {
			expect(parseBulkText("Capital of France :: Paris").detectedFormat).toBe(
				"double-colon",
			);
		});

		it("detects standalone cloze as double-colon format", () => {
			expect(parseBulkText("{{c1::Paris}} is the capital").detectedFormat).toBe(
				"double-colon",
			);
		});
	});
});
