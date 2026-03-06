import { describe, expect, it } from "vitest";
import { IncrementalFlashcardParser } from "../../../src/features/ai/services/incremental-flashcard-parser";
import type { NoteType } from "../../../src/shared/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_BASIC_REVERSED_ID,
} from "../../../src/shared/types/note.types";

const basicType: NoteType = {
	id: BUILTIN_BASIC_ID, name: "Basic", type: 0,
	fields: ["Front", "Back"],
	templates: [{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" }],
	css: "", isBuiltin: true, slug: "basic",
};

const clozeType: NoteType = {
	id: BUILTIN_CLOZE_ID, name: "Cloze", type: 1,
	fields: ["Text", "Extra"],
	templates: [{ name: "Cloze", ordinal: 0, qfmt: "{{cloze:Text}}", afmt: "{{cloze:Text}}<br>{{Extra}}" }],
	css: "", isBuiltin: true, slug: "cloze",
};

const reversedType: NoteType = {
	id: BUILTIN_BASIC_REVERSED_ID, name: "Basic (reversed)", type: 0,
	fields: ["Front", "Back"],
	templates: [
		{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
		{ name: "Card 2", ordinal: 1, qfmt: "{{Back}}", afmt: "{{Front}}" },
	],
	css: "", isBuiltin: true, slug: "basic-reversed",
};

const lookup = (slug: string) => {
	const map: Record<string, NoteType> = {
		basic: basicType, cloze: clozeType, "basic-reversed": reversedType,
	};
	return map[slug] ?? null;
};

describe("IncrementalFlashcardParser (block format)", () => {
	it("should parse a complete block fed at once", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const events = parser.feed(
			"#type/basic\nFront: What is X?\nBack: Y\n---\n",
		);

		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]!.block!.fields.Front).toBe("What is X?");
		expect(completes[0]!.block!.fields.Back).toBe("Y");
	});

	it("should parse a block completed on finish()", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		parser.feed("#type/basic\nFront: Q\nBack: A");
		const events = parser.finish();

		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]!.block!.noteTypeId).toBe(BUILTIN_BASIC_ID);
	});

	it("should parse multiple blocks in a stream", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const text = [
			"#type/basic",
			"Front: Q1",
			"Back: A1",
			"---",
			"#type/cloze",
			"Text: {{c1::Tokyo}} is in Japan",
			"Extra: Geography",
			"---",
		].join("\n");

		const events = [...parser.feed(text), ...parser.finish()];
		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(2);
		expect(completes[0]!.block!.noteTypeSlug).toBe("basic");
		expect(completes[1]!.block!.noteTypeSlug).toBe("cloze");
	});

	it("should handle chunk-by-chunk streaming", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const allEvents = [];

		allEvents.push(...parser.feed("#type/ba"));
		allEvents.push(...parser.feed("sic\nFront: What"));
		allEvents.push(...parser.feed(" is X?\nBack: Y"));
		allEvents.push(...parser.feed("\n---\n"));
		allEvents.push(...parser.finish());

		const completes = allEvents.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]!.block!.fields.Front).toBe("What is X?");
	});

	it("should emit partial updates during streaming", () => {
		const parser = new IncrementalFlashcardParser(lookup);

		parser.feed("#type/basic\n");
		const events = parser.feed("Front: Partial question\nBack: Partial ans");

		const partials = events.filter((e) => e.type === "partial_update");
		expect(partials.length).toBeGreaterThanOrEqual(1);
		const last = partials[partials.length - 1]!;
		expect(last.partialQuestion).toBe("Partial question");
	});

	it("should extract source comments", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const text = [
			"#type/basic",
			"Front: Q",
			"Back: A",
			"<!-- source: The source text -->",
			"---",
		].join("\n");

		const events = [...parser.feed(text), ...parser.finish()];
		const complete = events.find((e) => e.type === "card_complete");
		expect(complete).toBeDefined();
		expect(complete!.block!.sourceText).toBe("The source text");
	});

	it("should parse @typein metadata token", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const text = [
			"#type/basic",
			"Front: Q",
			"Back: A",
			"@typein",
			"---",
		].join("\n");

		const events = [...parser.feed(text), ...parser.finish()];
		const complete = events.find((e) => e.type === "card_complete");
		expect(complete).toBeDefined();
		expect(complete!.block!.alwaysTypeIn).toBe(true);
	});

	it("should handle reversed type", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		parser.feed("#type/basic-reversed\nFront: Capital of France\nBack: Paris\n---\n");
		const events = parser.finish();

		// All events from feed + finish
		const allEvents = [
			...parser.feed(""),  // empty to get remaining
			...events,
		];
		// The card_complete from feed should have been emitted
		const text = "#type/basic-reversed\nFront: Capital of France\nBack: Paris\n---\n";
		const p2 = new IncrementalFlashcardParser(lookup);
		const e2 = [...p2.feed(text), ...p2.finish()];
		const completes = e2.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(1);
		expect(completes[0]!.block!.noteTypeId).toBe(BUILTIN_BASIC_REVERSED_ID);
	});

	it("should skip unknown type tags", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const events = [
			...parser.feed("#type/unknown\nFront: Q\nBack: A\n---\n"),
			...parser.finish(),
		];
		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(0);
	});

	it("should handle a new #type tag finalizing previous block", () => {
		const parser = new IncrementalFlashcardParser(lookup);
		const text = [
			"#type/basic",
			"Front: Q1",
			"Back: A1",
			"#type/basic",
			"Front: Q2",
			"Back: A2",
		].join("\n");

		const events = [...parser.feed(text), ...parser.finish()];
		const completes = events.filter((e) => e.type === "card_complete");
		expect(completes).toHaveLength(2);
		expect(completes[0]!.block!.fields.Front).toBe("Q1");
		expect(completes[1]!.block!.fields.Front).toBe("Q2");
	});
});
