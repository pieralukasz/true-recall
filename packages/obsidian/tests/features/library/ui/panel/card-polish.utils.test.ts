import { describe, expect, it, vi } from "vitest";

import type { CardAIPreset } from "@true-recall/core";
import {
	type AIWorkflow,
	cardPolishWorkflowId,
} from "@true-recall/core/ai/workflows/ai-workflow";
import type { TrueRecallSettings } from "@true-recall/core/types";

import type { AssistantContextCard } from "@true-recall/obsidian/features/assistant/ui/ai-context-source";
import {
	describePolishRunMode,
	isCardPolishAvailable,
	listCardPolishWorkflows,
	startCardPolish,
} from "@true-recall/obsidian/features/library/ui/panel/utils/card-polish.utils";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

function createPreset(overrides: Partial<CardAIPreset> = {}): CardAIPreset {
	return {
		id: "preset-1",
		name: "Fix formatting",
		prompt: "Fix the formatting of this card.",
		autoApply: false,
		builtin: false,
		...overrides,
	};
}

function createWorkflow(overrides: Partial<AIWorkflow> = {}): AIWorkflow {
	return {
		id: cardPolishWorkflowId("preset-1"),
		name: "Fix formatting",
		kind: "modify-card",
		instruction: "Fix the formatting of this card.",
		sourcePresetId: "preset-1",
		autoApply: false,
		...overrides,
	};
}

function createSettings(
	overrides: Partial<TrueRecallSettings> = {},
): TrueRecallSettings {
	return {
		openRouterApiKey: "key",
		lmStudioModel: "",
		pluginStates: {},
		cardPolish: { userPresets: [createPreset()], customPromptAutoApply: false },
		...overrides,
	} as TrueRecallSettings;
}

describe("isCardPolishAvailable", () => {
	it("is available when both AI families are enabled and a key exists", () => {
		expect(isCardPolishAvailable(createSettings())).toBe(true);
	});

	it.each([
		["card-polish family off", { "card-polish": false }],
		["ai-assistant family off", { "ai-assistant": false }],
	])("is unavailable with %s", (_description, pluginStates) => {
		expect(isCardPolishAvailable(createSettings({ pluginStates }))).toBe(false);
	});

	it("is unavailable without an AI key", () => {
		expect(
			isCardPolishAvailable(createSettings({ openRouterApiKey: "" })),
		).toBe(false);
	});
});

describe("listCardPolishWorkflows", () => {
	it("projects the user presets into modify-card workflows", () => {
		const preset = createPreset({ autoApplyNewCards: true });
		const settings = createSettings({
			cardPolish: { userPresets: [preset], customPromptAutoApply: false },
		});

		expect(listCardPolishWorkflows(settings)).toEqual([
			{
				id: cardPolishWorkflowId(preset.id),
				name: preset.name,
				kind: "modify-card",
				instruction: preset.prompt,
				sourcePresetId: preset.id,
				autoApply: preset.autoApply,
				autoApplyNewCards: preset.autoApplyNewCards,
			},
		]);
	});

	it("excludes workflows of other kinds", () => {
		const settings = createSettings({
			assistantPresets: [
				{ id: "agent-1", name: "Explain", instruction: "Explain this." },
			],
		} as Partial<TrueRecallSettings>);

		const workflows = listCardPolishWorkflows(settings);
		expect(workflows).toHaveLength(1);
		expect(workflows[0]?.kind).toBe("modify-card");
	});

	it("returns an empty list when the bucket is missing", () => {
		expect(
			listCardPolishWorkflows(createSettings({ cardPolish: undefined })),
		).toEqual([]);
	});

	it("returns an empty list when the card-polish family is off", () => {
		expect(
			listCardPolishWorkflows(
				createSettings({ pluginStates: { "card-polish": false } }),
			),
		).toEqual([]);
	});
});

describe("describePolishRunMode", () => {
	it.each([
		["Preview", {}],
		["Apply edit", { autoApply: true }],
		["Apply new", { autoApplyNewCards: true }],
		["Apply all", { autoApply: true, autoApplyNewCards: true }],
	])("describes %s", (expected, overrides) => {
		expect(describePolishRunMode(createWorkflow(overrides))).toBe(expected);
	});
});

describe("startCardPolish", () => {
	const card: AssistantContextCard = {
		id: "card-1",
		noteId: "note-1",
		question: "Q",
		answer: "A",
		sourceUid: "abc123",
		sourceNotePath: "notes/source.md",
		fsrs: { noteTypeId: "basic" },
	};

	it("queues an inbox thread with the polish workflow id", () => {
		const startThread = vi.fn();
		const plugin = {
			assistantService: { startThread },
		} as unknown as TrueRecallPlugin;
		const workflow = createWorkflow();

		startCardPolish(plugin, workflow, card);

		expect(startThread).toHaveBeenCalledWith(
			expect.objectContaining({
				instruction: workflow.instruction,
				presetId: workflow.id,
				state: "inbox",
				displayMessage: workflow.name,
				context: expect.objectContaining({
					card: expect.objectContaining({ cardId: card.id }),
				}),
			}),
		);
	});

	it("is a no-op when the assistant service is missing", () => {
		const plugin = {} as TrueRecallPlugin;
		expect(() => startCardPolish(plugin, createWorkflow(), card)).not.toThrow();
	});
});
