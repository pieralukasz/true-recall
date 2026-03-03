/**
 * Bulk Card Parser Tests
 *
 * Tests multi-format text → ParsedCard[] conversion for the Quick tab.
 */
import { describe, expect, it } from "vitest";
import {
	parseBulkText,
	type ParsedCard,
} from "../../../src/features/study/services/flashcard/bulk-card-parser";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_CLOZE_ID,
} from "../../../src/shared/types/note.types";

describe("BulkCardParser", () => {
	// ── Tab-separated format ──────────────────────────────────

	describe("tab-separated format", () => {
		it("parses single tab-separated line", () => {
			const result = parseBulkText("What is ATP?\tAdenosine triphosphate");

			expect(result.detectedFormat).toBe("tab");
			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]!.noteTypeId).toBe(BUILTIN_BASIC_ID);
			expect(result.cards[0]!.fields).toEqual({
				Front: "What is ATP?",
				Back: "Adenosine triphosphate",
			});
		});

		it("parses multiple tab-separated lines", () => {
			const input = [
				"Capital of France\tParis",
				"Capital of Japan\tTokyo",
				"Capital of Germany\tBerlin",
			].join("\n");

			const result = parseBulkText(input);

			expect(result.detectedFormat).toBe("tab");
			expect(result.cards).toHaveLength(3);
		});

		it("skips empty lines", () => {
			const input = "Q1\tA1\n\nQ2\tA2";
			const result = parseBulkText(input);

			expect(result.cards).toHaveLength(2);
		});

		it("ignores lines without tabs when majority have tabs", () => {
			const input = [
				"Q1\tA1",
				"Q2\tA2",
				"This line has no tab",
				"Q3\tA3",
			].join("\n");

			const result = parseBulkText(input);

			expect(result.detectedFormat).toBe("tab");
			expect(result.cards).toHaveLength(3);
		});
	});

	// ── Double-colon format ───────────────────────────────────

	describe("double-colon format", () => {
		it("parses single :: separated line", () => {
			const result = parseBulkText("What is ATP? :: Adenosine triphosphate");

			expect(result.detectedFormat).toBe("double-colon");
			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]!.fields).toEqual({
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
			expect(result.cards[0]!.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]!.fields.Text).toBe(
				"{{c1::Paris}} is the capital of France",
			);
		});

		it("trims whitespace around separator", () => {
			const result = parseBulkText("  Question  ::  Answer  ");

			expect(result.cards[0]!.fields).toEqual({
				Front: "Question",
				Back: "Answer",
			});
		});
	});

	// ── Q:/A: format ──────────────────────────────────────────

	describe("Q:/A: format", () => {
		it("parses single Q/A pair", () => {
			const result = parseBulkText("Q: What is ATP?\nA: Adenosine triphosphate");

			expect(result.detectedFormat).toBe("qa");
			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]!.fields).toEqual({
				Front: "What is ATP?",
				Back: "Adenosine triphosphate",
			});
		});

		it("parses multiple Q/A pairs", () => {
			const input = [
				"Q: Capital of France",
				"A: Paris",
				"Q: Capital of Japan",
				"A: Tokyo",
			].join("\n");

			const result = parseBulkText(input);

			expect(result.detectedFormat).toBe("qa");
			expect(result.cards).toHaveLength(2);
		});

		it("handles multi-line answers", () => {
			const input = [
				"Q: Explain photosynthesis",
				"A: The process by which plants",
				"convert light energy into",
				"chemical energy",
			].join("\n");

			const result = parseBulkText(input);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]!.fields.Back).toContain("convert light energy");
		});

		it("is case-insensitive for Q:/A: markers", () => {
			const result = parseBulkText("q: What?\na: Answer");

			expect(result.detectedFormat).toBe("qa");
			expect(result.cards).toHaveLength(1);
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
			expect(clozeCard!.fields.Text).toBe(
				"{{c1::Paris}} is the capital of France",
			);
			expect(clozeCard!.fields.Extra).toBe("");
		});

		it("detects cloze in :: separated card (front side has cloze)", () => {
			const input = "{{c1::Mitochondria}} is the powerhouse :: Extra info";
			const result = parseBulkText(input);

			// The :: separator splits it, but front has cloze → becomes cloze card
			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]!.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]!.fields.Text).toBe(
				"{{c1::Mitochondria}} is the powerhouse",
			);
			expect(result.cards[0]!.fields.Extra).toBe("Extra info");
		});

		it("detects cloze in Q/A format", () => {
			const input = [
				"Q: {{c1::Paris}} is the capital of France",
				"A: Geography fact",
			].join("\n");

			const result = parseBulkText(input);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]!.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]!.fields.Text).toBe(
				"{{c1::Paris}} is the capital of France",
			);
		});

		it("detects cloze with hint syntax", () => {
			const result = parseBulkText("{{c1::Tokyo::capital city}} is in Japan");

			expect(result.cards[0]!.noteTypeId).toBe(BUILTIN_CLOZE_ID);
		});

		it("detects multiple cloze indices in one line", () => {
			const result = parseBulkText(
				"{{c1::Paris}} is the capital of {{c2::France}}",
			);

			expect(result.cards[0]!.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]!.fields.Text).toContain("{{c1::");
			expect(result.cards[0]!.fields.Text).toContain("{{c2::");
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

		it("tab format takes priority over :: format", () => {
			// Line has both tab and :: — tab format should win
			const result = parseBulkText("Front :: included\tBack answer");

			expect(result.detectedFormat).toBe("tab");
			expect(result.cards[0]!.fields.Front).toBe("Front :: included");
			expect(result.cards[0]!.fields.Back).toBe("Back answer");
		});
	});

	// ── Format detection accuracy ─────────────────────────────

	describe("format detection", () => {
		it("detects tab format", () => {
			expect(parseBulkText("Q\tA").detectedFormat).toBe("tab");
		});

		it("detects double-colon format", () => {
			expect(
				parseBulkText("Capital of France :: Paris").detectedFormat,
			).toBe("double-colon");
		});

		it("detects QA format", () => {
			expect(parseBulkText("Q: Question\nA: Answer").detectedFormat).toBe(
				"qa",
			);
		});
	});
});
