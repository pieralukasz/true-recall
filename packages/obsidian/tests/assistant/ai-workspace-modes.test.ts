import { describe, expect, it } from "vitest";

import {
	AI_WORKSPACE_MODES,
	isAIWorkspaceModeAvailable,
	workflowMatchesMode,
} from "../../src/features/assistant/ui/ai-workspace-modes";

describe("AI workspace modes", () => {
	it("keeps the three product surfaces in their intended order", () => {
		expect(AI_WORKSPACE_MODES.map((mode) => mode.id)).toEqual([
			"assistant",
			"generator",
			"card-polish",
		]);
	});

	it("enables each contextual mode only when its source is available", () => {
		expect(isAIWorkspaceModeAvailable("assistant", {})).toBe(true);
		expect(isAIWorkspaceModeAvailable("generator", {})).toBe(false);
		expect(
			isAIWorkspaceModeAvailable("generator", {
				source: { text: "A note to turn into cards" },
			}),
		).toBe(true);
		expect(
			isAIWorkspaceModeAvailable("card-polish", {
				card: {
					cardId: "card-1",
					question: "Question",
					answer: "Answer",
				},
			}),
		).toBe(true);
	});

	it("matches presets to the corresponding product mode", () => {
		const workflow = {
			id: "generation:basic",
			name: "Basic",
			kind: "generate-cards" as const,
			instruction: "Generate cards",
			sourcePresetId: "basic",
		};

		expect(workflowMatchesMode(workflow, "generator")).toBe(true);
		expect(workflowMatchesMode(workflow, "assistant")).toBe(false);
		expect(workflowMatchesMode(workflow, "card-polish")).toBe(false);
	});
});
