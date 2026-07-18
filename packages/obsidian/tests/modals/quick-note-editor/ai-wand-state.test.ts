import { describe, expect, it } from "vitest";

import { deriveAIWandState } from "../../../src/modals/study/quick-note-editor/ai-wand-state";

describe("deriveAIWandState", () => {
	it("is disabled when no source note is selected", () => {
		expect(
			deriveAIWandState({ hasSourceNote: false, assistantActive: true }),
		).toEqual({ disabled: true, title: "Select a source note first" });
	});

	it("is disabled when AI Assistant is inactive", () => {
		expect(
			deriveAIWandState({ hasSourceNote: true, assistantActive: false }),
		).toEqual({
			disabled: true,
			title: "Enable AI Assistant in plugin settings",
		});
	});

	it("is enabled with the default tooltip when both conditions are met", () => {
		expect(
			deriveAIWandState({ hasSourceNote: true, assistantActive: true }),
		).toEqual({ disabled: false, title: "Generate with AI" });
	});

	it("prioritizes the missing-source-note message over plugin state", () => {
		expect(
			deriveAIWandState({ hasSourceNote: false, assistantActive: false }).title,
		).toBe("Select a source note first");
	});
});
