/**
 * Bulk Card Parser Tests
 *
 * Tests `Front :: Back` text → ParsedCard[] conversion for the Quick tab.
 */
import { describe, expect, it } from "vitest";

import { parseBulkText } from "../../src/flashcard/parsing/bulk-card-parser";
import { getBuiltinNoteTypes } from "../../src/persistence/sqlite/modules/NoteTypeActions";
import { generateCardsForNote } from "../../src/services/cards/card-generation.service";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_CLOZE_ID,
	type NoteType,
} from "../../src/types/note.types";

function builtinType(id: string): NoteType {
	const noteType = getBuiltinNoteTypes().find((nt) => nt.id === id);
	if (!noteType) throw new Error(`missing builtin ${id}`);
	return noteType;
}

const threeFieldType: NoteType = {
	id: "custom-three",
	name: "Three",
	type: 0,
	fields: ["Word", "Meaning", "Example"],
	templates: [
		{ name: "Card 1", ordinal: 0, qfmt: "{{Word}}", afmt: "{{Meaning}}" },
	],
	css: "",
	isBuiltin: false,
};

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

		it("recognises a cloze whose answer contains braces", () => {
			const result = parseBulkText("Ratio: {{c1::$\\frac{a}{b}$}}");

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]?.fields.Text).toBe(
				"Ratio: {{c1::$\\frac{a}{b}$}}",
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

	// ── Import Studio (NoteType passed) ───────────────────────

	describe("with a Basic note type (Import Studio)", () => {
		const options = { noteType: builtinType(BUILTIN_BASIC_ID) };

		it("turns a line with two clozes into one Cloze note with two cards", () => {
			const result = parseBulkText(
				"{{c1::Paris}} is the capital of {{c2::France}}",
				options,
			);

			expect(result.cards).toHaveLength(1);
			const [card] = result.cards;
			expect(card?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(card?.fields).toEqual({
				Text: "{{c1::Paris}} is the capital of {{c2::France}}",
				Extra: "",
			});
			const generated = generateCardsForNote(
				{
					id: "n1",
					noteTypeId: BUILTIN_CLOZE_ID,
					fields: card?.fields ?? {},
					tags: [],
				},
				builtinType(BUILTIN_CLOZE_ID),
			);
			expect(generated.map((g) => g.templateOrd)).toEqual([1, 2]);
		});

		it("keeps a cloze line with an outer :: as Cloze with Extra, not raw Basic", () => {
			const result = parseBulkText(
				"{{c1::Paris}} is the capital :: of France",
				options,
			);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[0]?.fields).toEqual({
				Text: "{{c1::Paris}} is the capital",
				Extra: "of France",
			});
		});

		it("parses question::answer lines without cloze markers as Basic", () => {
			const result = parseBulkText(
				["Capital of France :: Paris", "{{c1::Tokyo}} is in Japan"].join("\n"),
				options,
			);

			expect(result.detectedFormat).toBe("double-colon");
			expect(result.cards.map((c) => c.noteTypeId)).toEqual([
				BUILTIN_BASIC_ID,
				BUILTIN_CLOZE_ID,
			]);
			expect(result.cards[0]?.fields).toEqual({
				Front: "Capital of France",
				Back: "Paris",
			});
		});

		it("treats a cloze line in tab format as Cloze with the second column as Extra", () => {
			const result = parseBulkText(
				["Front one\tBack one", "{{c1::Paris}} is a city\tFrance"].join("\n"),
				options,
			);

			expect(result.detectedFormat).toBe("tab");
			expect(result.cards[0]?.fields).toEqual({
				Front: "Front one",
				Back: "Back one",
			});
			expect(result.cards[1]?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.cards[1]?.fields).toEqual({
				Text: "{{c1::Paris}} is a city",
				Extra: "France",
			});
		});
	});

	describe("with a 3-field note type", () => {
		it("still detects cloze lines while tab lines map to the type's fields", () => {
			const result = parseBulkText(
				["dog\tpies\tThe dog barks", "{{c1::Kot}} to cat"].join("\n"),
				{ noteType: threeFieldType },
			);

			expect(result.cards).toHaveLength(2);
			expect(result.cards[0]?.fields).toEqual({
				Word: "dog",
				Meaning: "pies",
				Example: "The dog barks",
			});
			expect(result.cards[1]?.noteTypeId).toBe(BUILTIN_CLOZE_ID);
		});
	});

	describe("block format source comment", () => {
		it("carries the <!-- source --> quote on the parsed card", () => {
			const text = [
				"#type/basic",
				"Front: What is ATP?",
				"Back: Energy currency",
				"<!-- source: ATP stores energy -->",
				"---",
			].join("\n");
			const byslug = (slug: string) =>
				getBuiltinNoteTypes().find((nt) => nt.id === `builtin-${slug}`) ?? null;

			const result = parseBulkText(text, {
				noteType: builtinType(BUILTIN_BASIC_ID),
				getNoteType: byslug,
			});

			expect(result.detectedFormat).toBe("block");
			expect(result.cards[0]?.sourceText).toBe("ATP stores energy");
		});
	});
});
