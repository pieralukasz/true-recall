import { z } from "zod";

import {
	del,
	get,
	getWith,
	postParams,
	postTo,
	requireStringParam,
	type ToolDef,
} from "./_register.js";

const presetPath = (p: Record<string, unknown>) =>
	`/generation-presets/${encodeURIComponent(requireStringParam(p, "preset_id"))}`;

const presetFields = {
	name: z.string().min(1).describe("Display name (non-empty)"),
	prompt: z
		.string()
		.min(1)
		.describe(
			"Instruction for the AI; the plugin appends the card format from the note type",
		),
	noteTypeId: z
		.string()
		.describe(
			"ID of an existing note type from get_note_types, e.g. 'builtin-basic' or 'builtin-cloze'",
		),
	requiresPro: z
		.boolean()
		.describe("true if the preset may only run with a True Recall Pro key"),
	isDefault: z
		.boolean()
		.describe(
			"true makes this the default preset and clears the flag on all others",
		),
	includeSourceNote: z
		.boolean()
		.optional()
		.describe("Send the full source note to the AI as context"),
	includeRelatedCards: z
		.boolean()
		.optional()
		.describe("Send the note's existing cards to the AI as context"),
	allowEmptyAnswer: z
		.boolean()
		.optional()
		.describe("Accept generated cards with an empty answer (one-sided cards)"),
	languageOverride: z
		.string()
		.optional()
		.describe(
			"Language of the generated cards as an ISO code, or 'auto' to match the source",
		),
};

export const presetTools: ToolDef[] = [
	get(
		"list_generation_presets",
		"List the AI generation presets used by generate_flashcards_with_preset: each preset's id, name, noteTypeId, prompt, requiresPro, builtin and isDefault.",
		"/generation-presets",
	),

	getWith(
		"get_generation_preset",
		"Get one generation preset by id with all its fields. Fails with 404 for an unknown id.",
		{
			preset_id: z
				.string()
				.describe("Preset id (e.g. 'builtin-basic-flashcards' or a UUID)"),
		},
		presetPath,
	),

	postTo(
		"create_generation_preset",
		"Create a generation preset. name and prompt must be non-empty and noteTypeId must exist, otherwise it fails with 400 listing every problem. Returns the created preset with its new id.",
		{
			preset: z.object(presetFields).describe("The new preset's fields"),
		},
		() => "/generation-presets",
		(p) => p.preset,
	),

	postTo(
		"update_generation_preset",
		"Change some fields of a generation preset; fields you leave out keep their value, and unknown fields fail with 400. The old values are overwritten. Setting isDefault true clears it on all other presets. Built-in presets only accept isDefault and languageOverride (anything else fails with 403); to customize one, read it with get_generation_preset and pass its fields to create_generation_preset.",
		{
			preset_id: z.string().describe("Preset id to update"),
			patch: z
				.object({
					name: presetFields.name.optional(),
					prompt: presetFields.prompt.optional(),
					noteTypeId: presetFields.noteTypeId.optional(),
					requiresPro: presetFields.requiresPro.optional(),
					isDefault: presetFields.isDefault.optional(),
					includeSourceNote: presetFields.includeSourceNote,
					includeRelatedCards: presetFields.includeRelatedCards,
					allowEmptyAnswer: presetFields.allowEmptyAnswer,
					languageOverride: presetFields.languageOverride,
				})
				.strict()
				.describe("Only the fields to change"),
		},
		presetPath,
		(p) => p.patch,
	),

	del(
		"delete_generation_preset",
		"Delete a generation preset; this API cannot restore it. Built-in presets and the last remaining preset can't be deleted (403). Deleting the default preset makes the next preset the default.",
		{
			preset_id: z.string().describe("Preset id to delete"),
		},
		presetPath,
	),

	postParams(
		"generate_flashcards_with_preset",
		"Generate flashcards from text with the user's AI provider, using a generation preset for the note type and prompt, and save them to the note open in Obsidian. The text is sent to that provider; cards that duplicate existing ones are skipped. Needs an open markdown note (400 otherwise) and AI generation configured in the plugin. Prefer it over generate_flashcards when the user has presets. Returns created, duplicates, createdCardIds and the preset used.",
		"/generate-with-preset",
		{
			text: z
				.string()
				.min(1)
				.describe("The source text to generate flashcards from"),
			preset_id: z.string().describe("Preset id from list_generation_presets"),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Writes this flashcard_uid into the open note's frontmatter, replacing any existing one, before generating",
				),
		},
	),
];
