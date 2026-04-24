import { describe, expect, it } from "vitest";

import {
	IncrementalFlashcardParser,
	parseBlockResponse,
} from "../../src/ai/parsing/incremental-flashcard-parser";
import type { NoteType } from "../../src/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
} from "../../src/types/note.types";

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

const lookup = (slug: string) => {
	const map: Record<string, NoteType> = {
		basic: basicType,
		cloze: clozeType,
		"basic-reversed": reversedType,
	};
	return map[slug] ?? null;
};

describe("IncrementalFlashcardParser (JSON format)", () => {
	it("should parse a complete JSON array fed at once", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json = '[{"type": "basic", "Front": "What is X?", "Back": "Y"}]';
		const events = [...parser.feed(json), ...parser.finish()];

		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]?.block?.fields.Front).toBe("What is X?");
		expect(completes[0]?.block?.fields.Back).toBe("Y");
	});

	it("should parse an object completed on finish()", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		parser.feed('{"type": "basic", "Front": "Q", "Back": "A"');
		const events = parser.finish();

		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]?.block?.noteTypeId).toBe(BUILTIN_BASIC_ID);
	});

	it("should parse multiple objects in a JSON array", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json = JSON.stringify([
			{ type: "basic", Front: "Q1", Back: "A1" },
			{ type: "cloze", Text: "{{c1::Tokyo}} is in Japan", Extra: "Geography" },
		]);

		const events = [...parser.feed(json), ...parser.finish()];
		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(2);
		expect(completes[0]?.block?.noteTypeSlug).toBe("basic");
		expect(completes[1]?.block?.noteTypeSlug).toBe("cloze");
	});

	it("should handle chunk-by-chunk streaming", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const allEvents = [];

		allEvents.push(...parser.feed('[{"type": "bas'));
		allEvents.push(...parser.feed('ic", "Front": "What'));
		allEvents.push(...parser.feed(' is X?", "Back": "Y'));
		allEvents.push(...parser.feed('"}]'));
		allEvents.push(...parser.finish());

		const completes = allEvents.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]?.block?.fields.Front).toBe("What is X?");
	});

	it("should emit partial updates during streaming", () => {
		const parser = new IncrementalFlashcardParser(lookup);

		parser.feed("[");
		const events = parser.feed(
			'{"type": "basic", "Front": "Partial question", "Back": "Partial ans',
		);

		const partials = events.filter((e) => e.type === "partial_update");
		expect(partials.length).toBeGreaterThanOrEqual(1);
		const last = partials[partials.length - 1];
		if (!last) throw new Error("expected at least one partial_update event");
		expect(last.partialQuestion).toBe("Partial question");
	});

	it("should handle reversed type", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json =
			'[{"type": "basic-reversed", "Front": "Capital of France", "Back": "Paris"}]';
		const events = [...parser.feed(json), ...parser.finish()];

		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]?.block?.noteTypeId).toBe(BUILTIN_BASIC_REVERSED_ID);
	});

	it("should skip unknown types", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json = '[{"type": "unknown", "Front": "Q", "Back": "A"}]';
		const events = [...parser.feed(json), ...parser.finish()];
		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(0);
	});

	it("should handle strings with escaped quotes", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json =
			'[{"type": "basic", "Front": "What is \\"DNA\\"?", "Back": "Deoxyribonucleic acid"}]';
		const events = [...parser.feed(json), ...parser.finish()];

		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]?.block?.fields.Front).toBe('What is "DNA"?');
	});

	it("should handle cloze braces inside JSON strings", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json = JSON.stringify([
			{
				type: "cloze",
				Text: "The {{c1::mitochondria}} is the powerhouse",
				Extra: "",
			},
		]);
		const events = [...parser.feed(json), ...parser.finish()];

		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]?.block?.fields.Text).toBe(
			"The {{c1::mitochondria}} is the powerhouse",
		);
	});

	it("should skip empty-content objects", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json = '[{"type": "basic", "Front": "", "Back": ""}]';
		const events = [...parser.feed(json), ...parser.finish()];
		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(0);
	});

	it("should extract source field as sourceText", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json = JSON.stringify([
			{
				type: "basic",
				Front: "What is X?",
				Back: "Y",
				source: "X is defined as Y.",
			},
		]);
		const events = [...parser.feed(json), ...parser.finish()];
		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]?.block?.sourceText).toBe("X is defined as Y.");
	});

	it("should omit sourceText when source is missing", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const json = '[{"type": "basic", "Front": "Q", "Back": "A"}]';
		const events = [...parser.feed(json), ...parser.finish()];
		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes[0]?.block?.sourceText).toBeUndefined();
	});
});

describe("parseBlockResponse (non-streaming JSON)", () => {
	it("should parse a JSON array", () => {
		const text = JSON.stringify([
			{ type: "basic", Front: "Q1", Back: "A1" },
			{ type: "basic", Front: "Q2", Back: "A2" },
		]);
		const blocks = parseBlockResponse(text, lookup);
		expect(blocks).toHaveLength(2);
		expect(blocks[0]?.fields.Front).toBe("Q1");
		expect(blocks[1]?.fields.Front).toBe("Q2");
	});

	it("should handle markdown code fences around JSON", () => {
		const text = '```json\n[{"type": "basic", "Front": "Q", "Back": "A"}]\n```';
		const blocks = parseBlockResponse(text, lookup);
		expect(blocks).toHaveLength(1);
	});

	it("should handle extra text around JSON array", () => {
		const text =
			'Here are the flashcards:\n[{"type": "basic", "Front": "Q", "Back": "A"}]\nDone!';
		const blocks = parseBlockResponse(text, lookup);
		expect(blocks).toHaveLength(1);
	});

	it("should return empty for non-JSON text", () => {
		const blocks = parseBlockResponse("No flashcards here.", lookup);
		expect(blocks).toHaveLength(0);
	});

	it("should skip objects with unknown types", () => {
		const text = JSON.stringify([
			{ type: "basic", Front: "Q", Back: "A" },
			{ type: "unknown", Foo: "Bar" },
		]);
		const blocks = parseBlockResponse(text, lookup);
		expect(blocks).toHaveLength(1);
	});

	it("should extract source field as sourceText", () => {
		const text = JSON.stringify([
			{ type: "basic", Front: "Q", Back: "A", source: "Original sentence." },
		]);
		const blocks = parseBlockResponse(text, lookup);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.sourceText).toBe("Original sentence.");
	});
});
