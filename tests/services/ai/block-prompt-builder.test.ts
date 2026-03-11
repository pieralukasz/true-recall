import { describe, expect, it } from "vitest";
import {
	buildBlockPrompt,
	buildAutoPrompt,
} from "../../../src/features/ai/prompts/block-prompt-builder";
import type { NoteType } from "../../../src/shared/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
} from "../../../src/shared/types/note.types";

const basicType: NoteType = {
	id: BUILTIN_BASIC_ID,
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" }],
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
	templates: [{ name: "Cloze", ordinal: 0, qfmt: "{{cloze:Text}}", afmt: "{{cloze:Text}}<br>{{Extra}}" }],
	css: "",
	isBuiltin: true,
	slug: "cloze",
};

const customType: NoteType = {
	id: "custom-vocab",
	name: "Vocabulary",
	type: 0,
	fields: ["Word", "Translation", "Example"],
	templates: [{ name: "Card 1", ordinal: 0, qfmt: "{{Word}}", afmt: "{{Translation}}" }],
	css: "",
	isBuiltin: false,
	slug: "vocabulary",
};

describe("BlockPromptBuilder", () => {
	describe("buildBlockPrompt", () => {
		it("should include #type/basic in format section", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("#type/basic");
			expect(prompt).toContain("Front:");
			expect(prompt).toContain("Back:");
		});

		it("should include source tracking instructions", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("<!-- source:");
			expect(prompt).toContain("exact verbatim quote");
		});

		it("should include anti-tautology rules", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("Anti-Tautology");
		});

		it("should include backlink formatting rules", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("[[backlinks]]");
		});

		it("should include bolding rules", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("**bold**");
		});

		it("should include merge rule and strict source fidelity in basic v2", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("NUMBERED LISTS & BULLETS IN SOURCE");
			expect(prompt).toContain("THE MERGE RULE");
			expect(prompt).toContain("verbatim copy");
			expect(prompt).toContain("NO_NEW_CARDS");
		});

		it("should include new ultrathink rules in basic v2", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("TABLES & CODE BLOCKS");
			expect(prompt).toContain("ANSWER QUALITY RULES");
			expect(prompt).toContain("Anti-Source-Reference");
			expect(prompt).toContain("LANGUAGE MATCH");
		});

		it("should include --- separator instruction", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("Separate cards with ---");
		});

		it("should include cloze syntax for cloze types", () => {
			const prompt = buildBlockPrompt(clozeType);
			expect(prompt).toContain("{{c1::text}}");
			expect(prompt).toContain("#type/cloze");
			expect(prompt).toContain("Text:");
			expect(prompt).toContain("Extra:");
		});

		it("should NOT include cloze syntax for basic types", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).not.toContain("CLOZE SYNTAX RULES");
		});

		it("should handle custom NoteTypes with 3+ fields", () => {
			const prompt = buildBlockPrompt(customType);
			expect(prompt).toContain("#type/vocabulary");
			expect(prompt).toContain("Word:");
			expect(prompt).toContain("Translation:");
			expect(prompt).toContain("Example:");
		});

		it("should include NO_NEW_CARDS instruction", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("NO_NEW_CARDS");
		});

		it("should include few-shot examples for basic v2", () => {
			const prompt = buildBlockPrompt(basicType);
			expect(prompt).toContain("FEW-SHOT EXAMPLES");
			expect(prompt).toContain("rosacea");
			expect(prompt).toContain("aunt Irene");
			expect(prompt).toContain("kubek");
		});

		it("should include cloze example for cloze types", () => {
			const prompt = buildBlockPrompt(clozeType);
			expect(prompt).toContain("EXAMPLE:");
			expect(prompt).toContain("mitochondria");
			expect(prompt).toContain("{{c1::");
		});

		it("should not leak basic-only rules into non-basic prompts", () => {
			const prompt = buildBlockPrompt(customType);
			expect(prompt).not.toContain("NUMBERED LISTS & BULLETS IN SOURCE");
			expect(prompt).not.toContain("THE MERGE RULE");
			expect(prompt).not.toContain("ANSWER QUALITY RULES");
			expect(prompt).not.toContain(
				"ROLE: You are an expert in creating flashcards optimized",
			);
		});
	});

	describe("buildAutoPrompt", () => {
		it("should list non-reversed NoteTypes", () => {
			const prompt = buildAutoPrompt([basicType, clozeType, reversedType]);
			expect(prompt).toContain("#type/basic");
			expect(prompt).toContain("#type/cloze");
			expect(prompt).not.toContain("#type/basic-reversed");
		});

		it("should filter out reversed (multi-template) types", () => {
			const prompt = buildAutoPrompt([basicType, clozeType, reversedType]);
			expect(prompt).toContain("Standard Q&A");
			expect(prompt).toContain("Fill-in-the-blank");
			expect(prompt).not.toContain("Bidirectional Q&A");
		});

		it("should include custom types", () => {
			const prompt = buildAutoPrompt([basicType, customType]);
			expect(prompt).toContain("#type/vocabulary");
			expect(prompt).toContain("Word:");
		});

		it("should include shared rules", () => {
			const prompt = buildAutoPrompt([basicType]);
			expect(prompt).toContain("Anti-Tautology");
			expect(prompt).toContain("<!-- source:");
		});

		it("should include cloze rules", () => {
			const prompt = buildAutoPrompt([basicType, clozeType]);
			expect(prompt).toContain("CLOZE RULES");
		});
	});
});
