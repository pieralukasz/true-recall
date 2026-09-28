import { z } from "zod";

import {
	del,
	get,
	postTo,
	requireStringParam,
	type ToolDef,
} from "./_register.js";

const presetPath = (p: Record<string, unknown>) =>
	`/card-polish-presets/${encodeURIComponent(requireStringParam(p, "preset_id"))}`;

const polishFields = {
	name: z.string().min(1).describe("Display name (non-empty)"),
	prompt: z
		.string()
		.min(1)
		.describe("Instruction the AI follows when it polishes a card"),
	disabled: z
		.boolean()
		.optional()
		.describe("Hide the preset from run menus but keep it in settings"),
	autoApply: z
		.boolean()
		.optional()
		.describe("Apply the result without asking the user to review it"),
	autoApplyNewCards: z
		.boolean()
		.optional()
		.describe("Run the preset automatically on newly created cards"),
	includeSourceNote: z
		.boolean()
		.optional()
		.describe("Send the card's source note to the AI as context"),
	includeRelatedCards: z
		.boolean()
		.optional()
		.describe("Send the note's other cards to the AI as context"),
	mode: z
		.enum(["edit", "split", "spawn"])
		.optional()
		.describe(
			"edit rewrites the card; split replaces it with several cards; spawn adds new cards next to it",
		),
	fieldScope: z
		.enum(["all", "question", "answer", "empty-answer"])
		.optional()
		.describe(
			"Fields the AI may change; empty-answer only fills answers that are empty",
		),
};

export const polishTools: ToolDef[] = [
	get(
		"list_card_polish_presets",
		"List the user's Card Polish presets, the AI rewrites the user runs on cards in Obsidian: id, name, prompt, disabled, autoApply, autoApplyNewCards, mode and fieldScope. The tools here edit presets; they don't run them.",
		"/card-polish-presets",
	),

	postTo(
		"create_card_polish_preset",
		"Create a Card Polish preset. name and prompt must be non-empty; invalid or unknown fields fail with 400 listing every problem. Returns the created preset with its id.",
		{
			preset: z
				.object(polishFields)
				.strict()
				.describe("The new preset's fields"),
		},
		() => "/card-polish-presets",
		(p) => p.preset,
	),

	postTo(
		"update_card_polish_preset",
		"Change some fields of a Card Polish preset; fields you leave out keep their value and the old values are overwritten. Built-in presets can't be edited (403); unknown ids fail with 404.",
		{
			preset_id: z.string().describe("Preset id from list_card_polish_presets"),
			patch: z
				.object({
					...polishFields,
					name: polishFields.name.optional(),
					prompt: polishFields.prompt.optional(),
				})
				.strict()
				.describe("Only the fields to change"),
		},
		presetPath,
		(p) => p.patch,
	),

	del(
		"delete_card_polish_preset",
		"Delete a Card Polish preset; this API cannot restore it. Built-in presets can't be deleted (403); unknown ids fail with 404.",
		{
			preset_id: z.string().describe("Preset id from list_card_polish_presets"),
		},
		presetPath,
	),
];
