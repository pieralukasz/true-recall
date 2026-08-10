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

	it("locks the source card in explicit spawn mode", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
			mode: "spawn",
			fieldScope: "all",
		});
		expect(sys.content).toContain("SPAWN");
		expect(sys.content).toContain("verbatim");
	});

	it("declares a fixed SPLIT mode that replaces the source with item one", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
			mode: "split",
			fieldScope: "all",
		});
		expect(sys.content).toContain("SPLIT:");
		expect(sys.content).toContain("first atomic card in element [0]");
		expect(sys.content).toContain("Do not keep the unsplit source card");
		expect(sys.content).toContain("cannot be split meaningfully");
	});

	it("forbids extra cards in fixed edit mode", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toContain("Never create additional cards");
	});

	it("does not ask the model to infer mode from trigger words", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toContain("operation mode is fixed");
		expect(sys.content).not.toContain("pick exactly one");
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

	it("bakes invariant safety rules into the system prompt", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "" },
			noteType: basic,
			prompt: "Polish",
			operation: "edit",
		});
		expect(sys.content).toContain("Preserve empty fields");
		expect(sys.content).toContain("Preserve the card's factual meaning");
		expect(sys.content).toContain('labels such as "Q:"/"A:"');
	});

	it("locks the answer for a question-only edit", () => {
		const [sys] = buildCardAIMessages({
			fields: { Front: "Q", Back: "A" },
			noteType: basic,
			prompt: "Remove ambiguity",
			operation: "edit",
			mode: "edit",
			fieldScope: "question",
		});
		expect(sys.content).toContain('may change ONLY: "Front"');
		expect(sys.content).toContain(
			'locked fields character-for-character: "Back"',
		);
	});
});
