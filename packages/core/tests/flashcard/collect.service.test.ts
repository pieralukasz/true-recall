import { describe, expect, it } from "vitest";
import { CollectService } from "../../src/flashcard/lifecycle/collect.service";
import type { NoteType } from "../../src/types/note.types";
import { BUILTIN_BASIC_ID, BUILTIN_CLOZE_ID } from "../../src/types/note.types";

const basicType: NoteType = {
	id: BUILTIN_BASIC_ID,
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [
		{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
	],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

const clozeType: NoteType = {
	id: BUILTIN_CLOZE_ID,
	name: "Cloze",
	type: 1,
	fields: ["Text", "Extra"],
	templates: [
		{
			name: "Cloze",
			ordinal: 0,
			qfmt: "{{cloze:Text}}",
			afmt: "{{cloze:Text}}<br>{{Extra}}",
		},
	],
	css: "",
	isBuiltin: true,
	slug: "cloze",
};

const lookup = (slug: string) => {
	const map: Record<string, NoteType> = { basic: basicType, cloze: clozeType };
	return map[slug] ?? null;
};

describe("CollectService", () => {
	const service = new CollectService(lookup);

	describe("collect", () => {
		it("collects a single basic block", () => {
			const result = service.collect(
				"#type/basic\nFront: What is X?\nBack: Definition",
			);

			expect(result.collectedCount).toBe(1);
			expect(result.parsedBlocks).toHaveLength(1);
			expect(result.parsedBlocks[0]!.fields.Front).toBe("What is X?");
			expect(result.parsedBlocks[0]!.fields.Back).toBe("Definition");
		});

		it("collects multiple blocks separated by ---", () => {
			const content = [
				"#type/basic",
				"Front: Q1",
				"Back: A1",
				"---",
				"#type/basic",
				"Front: Q2",
				"Back: A2",
			].join("\n");
			const result = service.collect(content);

			expect(result.collectedCount).toBe(2);
			expect(result.parsedBlocks).toHaveLength(2);
		});

		it("skips non-block content", () => {
			const content = "Some text\nNo blocks here";
			const result = service.collect(content);

			expect(result.collectedCount).toBe(0);
			expect(result.parsedBlocks).toHaveLength(0);
		});

		it("returns empty for empty string", () => {
			const result = service.collect("");
			expect(result.collectedCount).toBe(0);
			expect(result.parsedBlocks).toHaveLength(0);
		});

		it("returns empty for whitespace-only input", () => {
			const result = service.collect("   \n  \n  ");
			expect(result.collectedCount).toBe(0);
			expect(result.parsedBlocks).toHaveLength(0);
		});

		it("collects cloze blocks", () => {
			const content = [
				"#type/cloze",
				"Text: {{c1::Tokyo}} is in {{c2::Japan}}",
				"Extra: Geography",
			].join("\n");
			const result = service.collect(content);

			expect(result.collectedCount).toBe(1);
			expect(result.parsedBlocks[0]!.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(result.parsedBlocks[0]!.fields.Text).toBe(
				"{{c1::Tokyo}} is in {{c2::Japan}}",
			);
		});

		it("returns original content unchanged as newContent", () => {
			const content = "Some text\n#type/basic\nFront: Q\nBack: A\nMore text";
			const result = service.collect(content);
			expect(result.newContent).toBe(content);
		});

		it("strips block content from newContentWithoutFlashcards", () => {
			const content = "Line 1\n#type/basic\nFront: Q\nBack: A\n---\nLine 2";
			const result = service.collect(content);

			expect(result.newContentWithoutFlashcards).toContain("Line 1");
			expect(result.newContentWithoutFlashcards).toContain("Line 2");
			expect(result.newContentWithoutFlashcards).not.toContain("#type/basic");
		});

		it("handles CRLF line endings", () => {
			const content =
				"#type/basic\r\nFront: Q1\r\nBack: A1\r\n---\r\n#type/basic\r\nFront: Q2\r\nBack: A2";
			const result = service.collect(content);
			expect(result.collectedCount).toBe(2);
		});

		it("extracts source text from blocks", () => {
			const content = [
				"#type/basic",
				"Front: Question",
				"Back: Answer",
				"<!-- source: The original text -->",
			].join("\n");
			const result = service.collect(content);

			expect(result.parsedBlocks[0]!.sourceText).toBe("The original text");
		});
	});

	describe("countFlashcardLines", () => {
		it("counts basic blocks", () => {
			const content =
				"#type/basic\nFront: Q1\nBack: A1\n---\n#type/basic\nFront: Q2\nBack: A2";
			expect(service.countFlashcardLines(content)).toBe(2);
		});

		it("returns 0 for non-block content", () => {
			expect(service.countFlashcardLines("Just text")).toBe(0);
		});

		it("returns 0 for empty input", () => {
			expect(service.countFlashcardLines("")).toBe(0);
		});
	});
});
