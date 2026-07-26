import { describe, expect, it } from "vitest";

import { buildAssistantSystemPrompt } from "../../../src/ai/assistant/assistant-prompts";

const NOTE_TYPES = [
	{ id: "builtin-basic", name: "Basic", fields: ["Front", "Back"] },
];

describe("buildAssistantSystemPrompt", () => {
	it("contains the methodology core and the note types", () => {
		const prompt = buildAssistantSystemPrompt({
			userInstructions: "",
			noteTypes: NOTE_TYPES,
			webSearchEnabled: true,
		});
		expect(prompt).toContain("ONE piece of information");
		expect(prompt).toContain("builtin-basic");
		expect(prompt).toContain("Front, Back");
		expect(prompt).toContain("same language");
	});

	it("mandates the split procedure for card-splitting instructions", () => {
		const prompt = buildAssistantSystemPrompt({
			userInstructions: "",
			noteTypes: NOTE_TYPES,
			webSearchEnabled: true,
		});
		expect(prompt).toContain("SPLIT PROCEDURE");
		expect(prompt).toContain("create_cards");
		expect(prompt).toContain("never leave the original unchanged");
	});

	it("appends user instructions when present", () => {
		const prompt = buildAssistantSystemPrompt({
			userInstructions: "Always answer in Polish.",
			noteTypes: NOTE_TYPES,
			webSearchEnabled: false,
		});
		expect(prompt).toContain("Always answer in Polish.");
		expect(prompt).toContain("web search is NOT available");
	});
});
