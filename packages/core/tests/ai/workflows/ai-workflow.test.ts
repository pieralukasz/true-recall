import { describe, expect, it } from "vitest";

import {
	assistantWorkflowId,
	cardPolishWorkflowId,
	customCardPolishWorkflowId,
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

	it("exposes generation workflows for a loaded source note", () => {
		const workflows = listAIWorkflows(settings, {
			hasSelection: false,
			hasSourceText: true,
			hasCard: false,
			hasDraftCard: false,
		});

		expect(workflows.map((workflow) => workflow.id)).toContain(
			generationWorkflowId("basic"),
		);
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

	it("hides a preset family whose feature is switched off", () => {
		const workflows = listAIWorkflows(settings, {
			hasSelection: true,
			hasCard: true,
			hasDraftCard: false,
			isFamilyEnabled: (kind) => kind !== "modify-card",
		});

		expect(workflows.map((workflow) => workflow.id)).toEqual([
			assistantWorkflowId("explain"),
			generationWorkflowId("basic"),
		]);
	});

	it("lists nothing when every family is switched off", () => {
		expect(
			listAIWorkflows(settings, {
				hasSelection: true,
				hasCard: true,
				hasDraftCard: true,
				isFamilyEnabled: () => false,
			}),
		).toEqual([]);
	});

	it("keeps resolution lenient so a family disabled mid-flight still runs", () => {
		expect(
			resolveAIWorkflow(settings, cardPolishWorkflowId("shorten"), {
				hasSelection: false,
				hasCard: true,
				hasDraftCard: false,
			}),
		).toMatchObject({ kind: "modify-card", sourcePresetId: "shorten" });
	});

	it("surfaces autoApply so the UI can show apply-vs-preview before running", () => {
		const workflows = listAIWorkflows(
			{
				...settings,
				cardPolish: {
					...settings.cardPolish,
					userPresets: [
						{ ...settings.cardPolish.userPresets[0], autoApply: true },
					],
				},
			},
			{ hasSelection: false, hasCard: true, hasDraftCard: false },
		);

		expect(
			workflows.find((workflow) => workflow.kind === "modify-card")?.autoApply,
		).toBe(true);
	});

	it("keeps auto-apply of edits separate from newly created cards", () => {
		const workflows = listAIWorkflows(
			{
				...settings,
				cardPolish: {
					...settings.cardPolish,
					userPresets: [
						{
							...settings.cardPolish.userPresets[0],
							autoApply: true,
							autoApplyNewCards: false,
						},
					],
				},
			},
			{ hasSelection: false, hasCard: true, hasDraftCard: false },
		);

		expect(
			workflows.find((workflow) => workflow.kind === "modify-card"),
		).toMatchObject({
			autoApply: true,
			autoApplyNewCards: false,
		});
	});

	it("resolves freeform Card Polish as a real workflow", () => {
		expect(
			resolveAIWorkflow(
				{
					...settings,
					cardPolish: {
						...settings.cardPolish,
						customPromptAutoApply: true,
					},
				},
				customCardPolishWorkflowId(),
				{ hasSelection: false, hasCard: true, hasDraftCard: false },
			),
		).toMatchObject({
			kind: "modify-card",
			sourcePresetId: "$custom",
			autoApply: true,
			autoApplyNewCards: false,
		});
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
