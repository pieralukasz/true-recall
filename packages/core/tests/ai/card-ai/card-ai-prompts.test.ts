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
});
