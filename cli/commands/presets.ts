import type { CommandDef } from "../registry.js";
import { del, get, getWith, postParams, postTo } from "../registry.js";

const C = "AI Generation";

export const presetCommands: CommandDef[] = [
	get(
		"list_generation_presets",
		"List all generation presets (id, name, noteTypeId, prompt, requiresPro, isDefault).",
		C,
		"/generation-presets",
	),

	getWith(
		"get_generation_preset",
		"Fetch a single generation preset by id.",
		C,
		{
			preset_id: {
				type: "string",
				description:
					"The preset id (e.g. 'builtin-basic-flashcards' or a UUID)",
				required: true,
			},
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
	),

	postParams(
		"create_generation_preset",
		"Create a generation preset. Body: full GenerationPreset JSON minus id/createdAt/updatedAt. Validation is strict.",
		C,
		"/generation-presets",
		{
			preset: {
				type: "json",
				description:
					"Full preset JSON: { name, prompt, noteTypeId, requiresPro, isDefault }",
				required: true,
			},
		},
	),

	postTo(
		"update_generation_preset",
		"Update a generation preset (PATCH). Top-level keys are merged.",
		C,
		{
			preset_id: {
				type: "string",
				description: "The preset id to update",
				required: true,
			},
			patch: {
				type: "json",
				description:
					"Partial preset JSON. Valid keys: name, prompt, noteTypeId, requiresPro, isDefault.",
				required: true,
			},
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
		(p) => p.patch,
	),

	del(
		"delete_generation_preset",
		"Delete a generation preset. Built-in preset cannot be deleted. Deleting the default auto-promotes the next preset.",
		C,
		{
			preset_id: {
				type: "string",
				description: "The preset id to delete",
				required: true,
			},
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
	),

	get(
		"list_card_polish_presets",
		"List all Card Polish presets (id, name, prompt, disabled, autoApply, autoApplyNewCards, mode).",
		"Card Polish",
		"/card-polish-presets",
	),

	postTo(
		"create_card_polish_preset",
		"Create a Card Polish preset. Body keys: name, prompt (required); disabled, autoApply, autoApplyNewCards, includeSourceNote, includeRelatedCards (booleans); mode (edit|split|spawn); fieldScope (all|question|answer|empty-answer).",
		"Card Polish",
		{
			preset: {
				type: "json",
				description:
					"Preset JSON: { name, prompt, disabled?, autoApply?, autoApplyNewCards?, includeSourceNote?, includeRelatedCards?, mode?, fieldScope? }",
				required: true,
			},
		},
		() => "/card-polish-presets",
		(p) => p.preset,
	),

	postTo(
		"update_card_polish_preset",
		"Update a Card Polish preset (PATCH merge). Builtin presets cannot be edited.",
		"Card Polish",
		{
			preset_id: {
				type: "string",
				description: "The preset id to update",
				required: true,
			},
			patch: {
				type: "json",
				description:
					"Partial preset JSON. Valid keys: name, prompt, disabled, autoApply, autoApplyNewCards, includeSourceNote, includeRelatedCards, mode, fieldScope.",
				required: true,
			},
		},
		(p) => `/card-polish-presets/${encodeURIComponent(String(p.preset_id))}`,
		(p) => p.patch,
	),

	del(
		"delete_card_polish_preset",
		"Delete a Card Polish preset. Builtin presets cannot be deleted.",
		"Card Polish",
		{
			preset_id: {
				type: "string",
				description: "The preset id to delete",
				required: true,
			},
		},
		(p) => `/card-polish-presets/${encodeURIComponent(String(p.preset_id))}`,
	),

	postParams(
		"generate_flashcards_with_preset",
		"Generate flashcards from text using a specific preset id (instead of a raw note-type slug). Requires an active markdown note in Obsidian.",
		C,
		"/generate-with-preset",
		{
			text: {
				type: "string",
				description: "The source text to generate flashcards from",
				required: true,
			},
			preset_id: {
				type: "string",
				description: "The preset id to use for generation",
				required: true,
			},
			source_uid: {
				type: "string",
				description:
					"Override source UID for the active note (writes to frontmatter if different).",
			},
		},
	),
];
