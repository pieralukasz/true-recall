import type { CommandDef } from "../registry.js";
import { del, get, getWith, postParams, postTo } from "../registry.js";

const C = "AI Generation";

export const presetCommands: CommandDef[] = [
	get(
		"list_generation_presets",
		"List all generation presets (id, name, noteTypeId, fields, isPinned, isDefault).",
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
					"Full preset JSON: { name, noteTypeId, fields, tts, customPrompt?, isPinned, isDefault }",
				required: true,
			},
		},
	),

	postTo(
		"update_generation_preset",
		"Update a generation preset (PATCH). Top-level keys are merged; if fields or tts are provided, they atomically replace the existing sub-object.",
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
					"Partial preset JSON. Valid keys: name, noteTypeId, fields, tts, customPrompt, isPinned, isDefault.",
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
