import { describe, expect, it } from "vitest";

import { chatTask } from "../../../src/features/ai-chat/engine/chat-transport";

const card = { id: "c1", label: "Q" };
const preset = { name: "Condense", instruction: "Make it shorter." };

describe("chatTask", () => {
	it("marks a Card Polish preset run on a card", () => {
		expect(chatTask({ context: { card, preset } })).toBe("card-polish");
	});

	it("marks a fact check on a card", () => {
		expect(chatTask({ context: { card }, factCheck: true })).toBe("fact-check");
	});

	it("treats everything else as open chat", () => {
		expect(chatTask({ context: { card } })).toBe("chat");
		expect(
			chatTask({
				context: { preset: { ...preset, id: "builtin-basic-pro-flashcards" } },
			}),
		).toBe("chat");
		expect(chatTask({ context: {} })).toBe("chat");
	});
});
