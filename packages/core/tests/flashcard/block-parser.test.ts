import { describe, expect, it } from "vitest";
import {
	blocksToText,
	blockToText,
	countBlocks,
	type NoteTypeLookup,
	parseBlocks,
} from "../../src/flashcard/parsing/block-parser.service";
import type { NoteType } from "../../src/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
} from "../../src/types/note.types";

// ── Test NoteType fixtures ──────────────────────────────

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

const reversedType: NoteType = {
	id: BUILTIN_BASIC_REVERSED_ID,
	name: "Basic (reversed)",
	type: 0,
	fields: ["Front", "Back"],
	templates: [
		{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
		{ name: "Card 2", ordinal: 1, qfmt: "{{Back}}", afmt: "{{Front}}" },
	],
	css: "",
	isBuiltin: true,
	slug: "basic-reversed",
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

const customType: NoteType = {
	id: "custom-vocab",
	name: "Vocabulary",
	type: 0,
	fields: ["Word", "Translation", "Example"],
	templates: [
		{
			name: "Card 1",
			ordinal: 0,
			qfmt: "{{Word}}",
			afmt: "{{Translation}}<br>{{Example}}",
		},
	],
	css: "",
	isBuiltin: false,
	slug: "vocabulary",
};

const lookup: NoteTypeLookup = (slug) => {
	const map: Record<string, NoteType> = {
		basic: basicType,
		"basic-reversed": reversedType,
		cloze: clozeType,
		vocabulary: customType,
	};
	return map[slug] ?? null;
};

// ── Parsing ─────────────────────────────────────────────

describe("BlockParser", () => {
	describe("parseBlocks", () => {
		it("should parse a single basic block", () => {
			const content = `#type/basic
Front: What is photosynthesis?
Back: Process of converting light to energy`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.noteTypeId).toBe(BUILTIN_BASIC_ID);
			expect(blocks[0]!.noteTypeSlug).toBe("basic");
			expect(blocks[0]!.fields.Front).toBe("What is photosynthesis?");
			expect(blocks[0]!.fields.Back).toBe(
				"Process of converting light to energy",
			);
		});

		it("should parse multiple blocks separated by ---", () => {
			const content = `#type/basic
Front: Question 1
Back: Answer 1
---
#type/basic
Front: Question 2
Back: Answer 2`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(2);
			expect(blocks[0]!.fields.Front).toBe("Question 1");
			expect(blocks[1]!.fields.Front).toBe("Question 2");
		});

		it("should parse cloze blocks", () => {
			const content = `#type/cloze
Text: {{c1::Tokio}} is the capital of {{c2::Japan}}
Extra: Geography fact`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.noteTypeId).toBe(BUILTIN_CLOZE_ID);
			expect(blocks[0]!.fields.Text).toBe(
				"{{c1::Tokio}} is the capital of {{c2::Japan}}",
			);
			expect(blocks[0]!.fields.Extra).toBe("Geography fact");
		});

		it("should parse reversed blocks", () => {
			const content = `#type/basic-reversed
Front: Capital of France
Back: Paris`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.noteTypeId).toBe(BUILTIN_BASIC_REVERSED_ID);
		});

		it("should parse custom NoteType blocks", () => {
			const content = `#type/vocabulary
Word: Zaparzacz
Translation: French press
Example: Kupiłem nowy zaparzacz do kawy.`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.noteTypeId).toBe("custom-vocab");
			expect(blocks[0]!.fields.Word).toBe("Zaparzacz");
			expect(blocks[0]!.fields.Translation).toBe("French press");
			expect(blocks[0]!.fields.Example).toBe("Kupiłem nowy zaparzacz do kawy.");
		});

		it("should handle multi-line field values", () => {
			const content = `#type/vocabulary
Word: Zaparzacz
Translation: French press
Example:
Kupiłem nowy zaparzacz do kawy.
Codziennie rano robię w nim arabikę.`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.fields.Example).toBe(
				"Kupiłem nowy zaparzacz do kawy.\nCodziennie rano robię w nim arabikę.",
			);
		});

		it("should extract source comments", () => {
			const content = `#type/basic
Front: What is photosynthesis?
Back: Process of converting light to energy
<!-- source: Photosynthesis is the process by which plants convert light -->`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.sourceText).toBe(
				"Photosynthesis is the process by which plants convert light",
			);
		});

		it("should parse @typein metadata token", () => {
			const content = `#type/basic
Front: Q
Back: A
@typein`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.alwaysTypeIn).toBe(true);
			expect(blocks[0]!.fields.Back).toBe("A");
		});

		it("should skip YAML frontmatter", () => {
			const content = `---
title: My Note
tags: [biology]
---
#type/basic
Front: What is photosynthesis?
Back: Energy conversion`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.fields.Front).toBe("What is photosynthesis?");
		});

		it("should return non-block content in contentWithoutBlocks", () => {
			const content = `Some regular note text.

More content here.

#type/basic
Front: Question
Back: Answer
---

And more regular text after.`;

			const { blocks, contentWithoutBlocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(contentWithoutBlocks).toContain("Some regular note text.");
			expect(contentWithoutBlocks).toContain("More content here.");
			expect(contentWithoutBlocks).toContain("And more regular text after.");
			expect(contentWithoutBlocks).not.toContain("#type/basic");
		});

		it("should ignore blocks with unknown slugs", () => {
			const content = `#type/unknown-type
Front: Question
Back: Answer`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(0);
		});

		it("should skip blocks with no content in fields", () => {
			const content = `#type/basic`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(0);
		});

		it("should only recognize field names from the block's NoteType", () => {
			// "Example:" is NOT a field of basic type, so it's part of Back value
			const content = `#type/basic
Front: What is a French press?
Back: A coffee brewing device.
Example: Used daily for making arabica.`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.fields.Back).toBe(
				"A coffee brewing device.\nExample: Used daily for making arabica.",
			);
		});

		it("should handle mixed blocks and regular content", () => {
			const content = `---
title: Mixed Note
---
Some introduction text.

#type/basic
Front: Q1
Back: A1
---
Middle paragraph that is not a card.
---
#type/cloze
Text: {{c1::Rome}} is in Italy
Extra: European capitals`;

			const { blocks, contentWithoutBlocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(2);
			expect(blocks[0]!.noteTypeSlug).toBe("basic");
			expect(blocks[1]!.noteTypeSlug).toBe("cloze");
			expect(contentWithoutBlocks).toContain("Some introduction text.");
			expect(contentWithoutBlocks).toContain(
				"Middle paragraph that is not a card.",
			);
		});

		it("should handle empty fields gracefully", () => {
			const content = `#type/basic
Front: Question
Back:`;

			const { blocks } = parseBlocks(content, lookup);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.fields.Front).toBe("Question");
			expect(blocks[0]!.fields.Back).toBe("");
		});

		it("should preserve frontmatter in contentWithoutBlocks", () => {
			const content = `---
title: Test
---
#type/basic
Front: Q
Back: A`;

			const { contentWithoutBlocks } = parseBlocks(content, lookup);
			expect(contentWithoutBlocks).toContain("title: Test");
		});
	});

	// ── Serialization ───────────────────────────────────────

	describe("blockToText", () => {
		it("should serialize a basic block", () => {
			const text = blockToText(
				{
					noteTypeId: BUILTIN_BASIC_ID,
					noteTypeSlug: "basic",
					fields: { Front: "Question", Back: "Answer" },
				},
				["Front", "Back"],
			);
			expect(text).toBe("#type/basic\nFront: Question\nBack: Answer");
		});

		it("should serialize multi-line values with field name on its own line", () => {
			const text = blockToText(
				{
					noteTypeId: "custom-vocab",
					noteTypeSlug: "vocabulary",
					fields: {
						Word: "Zaparzacz",
						Translation: "French press",
						Example: "Line 1\nLine 2",
					},
				},
				["Word", "Translation", "Example"],
			);
			expect(text).toContain("Example:\nLine 1\nLine 2");
		});

		it("should include source comment when present", () => {
			const text = blockToText(
				{
					noteTypeId: BUILTIN_BASIC_ID,
					noteTypeSlug: "basic",
					fields: { Front: "Q", Back: "A" },
					sourceText: "The source quote",
				},
				["Front", "Back"],
			);
			expect(text).toContain("<!-- source: The source quote -->");
		});

		it("should include @typein token when alwaysTypeIn is true", () => {
			const text = blockToText(
				{
					noteTypeId: BUILTIN_BASIC_ID,
					noteTypeSlug: "basic",
					fields: { Front: "Q", Back: "A" },
					alwaysTypeIn: true,
				},
				["Front", "Back"],
			);
			expect(text).toContain("@typein");
		});
	});

	describe("blocksToText", () => {
		it("should join multiple blocks with ---", () => {
			const text = blocksToText(
				[
					{
						noteTypeId: BUILTIN_BASIC_ID,
						noteTypeSlug: "basic",
						fields: { Front: "Q1", Back: "A1" },
					},
					{
						noteTypeId: BUILTIN_BASIC_ID,
						noteTypeSlug: "basic",
						fields: { Front: "Q2", Back: "A2" },
					},
				],
				() => ["Front", "Back"],
			);
			expect(text).toContain("---");
			expect(text.split("---")).toHaveLength(2);
		});
	});

	describe("countBlocks", () => {
		it("should count valid blocks", () => {
			const content = `#type/basic
Front: Q1
Back: A1
---
#type/basic
Front: Q2
Back: A2
---
Not a block`;

			expect(countBlocks(content, lookup)).toBe(2);
		});
	});
});
