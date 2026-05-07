import { describe, expect, it } from "vitest";

import { buildCardAIMessages } from "@true-recall/plugins/shared/card-ai/card-ai-prompts";

const basic = { name: "Basic", fields: ["Front", "Back"] as const };

describe("buildCardAIMessages", () => {
	it("lists field names in the system prompt", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toContain(`"Front"`);
		expect(sys.content).toContain(`"Back"`);
	});

	it("names the note type in the system prompt", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toContain(`note type "Basic"`);
	});

	it("names the note type in the user prompt", () => {
		const [, user] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(user.content).toContain("note type: Basic");
	});

	it("marks empty fields explicitly", () => {
		const [, user] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(user.content).toContain("Back: (empty)");
	});

	it("includes source note when provided", () => {
		const [, user] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
			context: { sourceNotePath: "n.md", sourceNoteContent: "body" },
		});
		expect(user.content).toContain("Source note");
		expect(user.content).toContain("n.md");
		expect(user.content).toContain("body");
	});

	it("includes related cards when provided", () => {
		const [, user] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
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
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(user.content).not.toContain("Source note");
		expect(user.content).not.toContain("Related flashcards");
	});

	it("uses create-mode copy for new draft flashcards", () => {
		const [sys, user] = buildCardAIMessages({
			fields: { Front: "", Back: "" },
			noteType: basic,
			prompt: "Create a new card",
			operation: "create",
		});
		expect(sys.content).toContain("drafting a NEW flashcard");
		expect(user.content).toContain("Current draft");
	});

	it("instructs the model to respond with a JSON array (not object)", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toContain("ONLY a JSON array");
	});

	it("contains the verbatim safety net rule", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toContain("When in doubt");
		expect(sys.content).toContain("VERBATIM");
	});

	it("explicitly forbids modifying [0] when not requested", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toMatch(/Do NOT modify \[0\]/);
	});

	it("explicitly forbids inventing extra cards", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toMatch(/Do NOT invent cards/);
	});

	it("contains bilingual triggers for spawn intent (EN + PL)", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toContain("create a card about");
		expect(sys.content).toContain("stwórz fiszkę");
	});

	it("does not bake a hard cap on the number of new cards", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).not.toMatch(/\bmax\s+\d+\b/i);
		expect(sys.content).not.toMatch(/\bup to\s+\d+\b/i);
	});

	it("does not bake editorial rules into the system prompt", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		// Editorial rules (atomicity, verbatim preservation, language matching,
		// empty-field policy) live in user-authored presets, not the system
		// prompt. Adding them here fights presets that intentionally relax them.
		expect(sys.content).not.toMatch(/atomic/i);
		expect(sys.content).not.toMatch(/best practices/i);
		expect(sys.content).not.toMatch(/preserve facts/i);
		expect(sys.content).not.toMatch(/same language/i);
		expect(sys.content).not.toMatch(/empty fields?/i);
		expect(sys.content).not.toMatch(/wikilinks?/i);
	});
});
