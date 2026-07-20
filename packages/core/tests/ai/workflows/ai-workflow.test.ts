import { describe, expect, it } from "vitest";

import {
	assistantWorkflowId,
	cardPolishWorkflowId,
	generationWorkflowId,
	listAIWorkflows,
	resolveAIWorkflow,
} from "../../../src/ai/workflows/ai-workflow";
import { DEFAULT_SETTINGS } from "../../../src/constants";

describe("AI workflow facade", () => {
	const defaultGenerationPreset = DEFAULT_SETTINGS.generationPresets[0];
	if (!defaultGenerationPreset)
		throw new Error("Missing default generation preset");
	const settings = {
		...DEFAULT_SETTINGS,
		assistantPresets: [
			{ id: "explain", name: "Explain", instruction: "Explain this" },
		],
		generationPresets: [
			{
				...defaultGenerationPreset,
				id: "basic",
				name: "Basic cards",
				prompt: "Generate atomic cards",
			},
		],
		cardPolish: {
			customPromptAutoApply: false,
			userPresets: [
				{
					id: "shorten",
					name: "Shorten",
					prompt: "Make the answer shorter",
					autoApply: false,
					builtin: false,
				},
			],
		},
	};

	it("shows only workflows applicable to a text selection", () => {
		const workflows = listAIWorkflows(settings, {
			hasSelection: true,
			hasCard: false,
			hasDraftCard: false,
		});

		expect(workflows.map((workflow) => workflow.id)).toEqual([
			assistantWorkflowId("explain"),
			generationWorkflowId("basic"),
		]);
		expect(workflows[1]).toMatchObject({
			kind: "generate-cards",
			instruction: "Generate atomic cards",
			sourcePresetId: "basic",
		});
	});

	it("exposes Card Polish presets for existing and draft cards", () => {
		const workflows = listAIWorkflows(settings, {
			hasSelection: false,
			hasCard: false,
			hasDraftCard: true,
		});

		expect(workflows.map((workflow) => workflow.id)).toEqual([
			assistantWorkflowId("explain"),
			cardPolishWorkflowId("shorten"),
		]);
	});

	it("resolves raw Assistant preset ids from tasks created before namespacing", () => {
		expect(
			resolveAIWorkflow(settings, "explain", {
				hasSelection: false,
				hasCard: true,
				hasDraftCard: false,
			}),
		).toMatchObject({
			id: assistantWorkflowId("explain"),
			kind: "agent",
			sourcePresetId: "explain",
		});
	});
});
