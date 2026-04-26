import { describe, expect, it } from "vitest";

import { buildCardAIMessages } from "../../../src/ai/card-ai/card-ai-prompts";

describe("buildCardAIMessages", () => {
	it("lists field names in the system prompt", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		expect(sys.content).toContain(`"Front"`);
		expect(sys.content).toContain(`"Back"`);
	});

	it("marks empty fields explicitly", () => {
		const [, user] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		expect(user.content).toContain("Back: (empty)");
	});

	it("includes source note when provided", () => {
		const [, user] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
			context: { sourceNotePath: "n.md", sourceNoteContent: "body" },
		});
		expect(user.content).toContain("Source note");
		expect(user.content).toContain("n.md");
		expect(user.content).toContain("body");
	});

	it("includes related cards when provided", () => {
		const [, user] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
			context: {
				relatedCards: [
					{ noteType: "Basic", fields: { Front: "P", Back: "A" } },
				],
			},
		});
		expect(user.content).toContain("Related flashcards");
		expect(user.content).toContain("P");
	});

	it("omits context sections when absent", () => {
		const [, user] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		expect(user.content).not.toContain("Source note");
		expect(user.content).not.toContain("Related flashcards");
	});

	it("instructs the model to respond with a JSON array (not object)", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		expect(sys.content).toContain("ONLY a JSON array");
	});

	it("contains the verbatim safety net rule", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		expect(sys.content).toContain("When in doubt");
		expect(sys.content).toContain("verbatim");
	});

	it("explicitly forbids modifying [0] when not requested", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		expect(sys.content).toMatch(/Do NOT modify \[0\]/);
	});

	it("explicitly forbids inventing extra cards", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		expect(sys.content).toMatch(/Do NOT invent cards/);
	});

	it("contains bilingual triggers for spawn intent (EN + PL)", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		expect(sys.content).toContain("create a card about");
		expect(sys.content).toContain("stwórz fiszkę");
	});

	it("does not bake a hard cap on the number of new cards", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		// Guard against accidental "max 5", "up to 10", etc. constraints leaking
		// into the prompt. The model should follow the user's instruction 1:1.
		expect(sys.content).not.toMatch(/\bmax\s+\d+\b/i);
		expect(sys.content).not.toMatch(/\bup to\s+\d+\b/i);
	});

	it("does not instruct the model to fill empty fields on its own", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		// The system prompt used to tell the model to write content for empty
		// fields "to fit the instruction and follow flashcard best practices".
		// That actively fought user presets that ask to leave a field empty
		// (e.g. one-sided cloze-style cards). Keep the empty-field rule strict.
		expect(sys.content).not.toMatch(/empty field.*write content/i);
		expect(sys.content).not.toMatch(/best practices/i);
		expect(sys.content).toMatch(/leave it unchanged/i);
		expect(sys.content).toMatch(/Do not invent content for empty fields/i);
	});

	it("does not normalize wikilinks as a preserved feature", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			prompt: "Polish",
		});
		// Mentioning wikilinks ([[...]]) in the system prompt — even under
		// "preserve verbatim" — primes the model to treat them as normal output
		// for this domain and produce noisy AI-generated [[concept]] tagging.
		// The general "preserve verbatim" rules already cover wikilinks that
		// exist in the source as plain text.
		expect(sys.content).not.toMatch(/\[\[\.\.\.\]\]/);
		expect(sys.content).not.toMatch(/wikilinks?/i);
	});
});
