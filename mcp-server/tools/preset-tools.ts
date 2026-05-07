import { z } from "zod";

import {
	del,
	get,
	getWith,
	postParams,
	postTo,
	type ToolDef,
} from "./_register.js";

export const presetTools: ToolDef[] = [
	get(
		"list_generation_presets",
		"List all generation presets. Returns array with each preset's id, name, noteTypeId, prompt, requiresPro, isDefault. Use before create/update/delete to see what exists.",
		"/generation-presets",
	),

	getWith(
		"get_generation_preset",
		"Fetch a single generation preset by id. Returns full preset JSON.",
		{
			preset_id: z
				.string()
				.describe("Preset id (e.g. 'builtin-basic-flashcards' or a UUID)"),
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
	),

	postParams(
		"create_generation_preset",
		"Create a new generation preset. Validation is strict: name non-empty, prompt non-empty, noteTypeId must exist. Body is the full preset JSON minus id/createdAt/updatedAt.",
		"/generation-presets",
		{
			preset: z
				.object({
					name: z.string(),
					prompt: z.string(),
					noteTypeId: z.string(),
					requiresPro: z.boolean(),
					isDefault: z.boolean(),
				})
				.describe("Full preset JSON minus id/createdAt/updatedAt"),
		},
	),

	postTo(
		"update_generation_preset",
		"Update a generation preset (PATCH semantics). Only provided top-level keys are changed. Unknown keys are rejected with 400. Setting isDefault:true auto-unsets default on all other presets. Built-in presets cannot be edited — duplicate them first with duplicate semantics (use list + create).",
		{
			preset_id: z.string().describe("Preset id to update"),
			patch: z
				.object({
					name: z.string().optional(),
					prompt: z.string().optional(),
					noteTypeId: z.string().optional(),
					requiresPro: z.boolean().optional(),
					isDefault: z.boolean().optional(),
				})
				.describe("Partial preset JSON"),
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
		(p) => p.patch,
	),

	del(
		"delete_generation_preset",
		"Delete a generation preset. Built-in presets cannot be deleted. Deleting the default preset auto-promotes the next preset to default. Deleting the last preset is blocked.",
		{
			preset_id: z.string().describe("Preset id to delete"),
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
	),

	postParams(
		"generate_flashcards_with_preset",
		"Generate flashcards from text using a specific preset_id. Preset controls the note type and system prompt. Prefer this over generate_flashcards when the user has configured presets. Requires an active markdown note in Obsidian.",
		"/generate-with-preset",
		{
			text: z.string().describe("The source text to generate flashcards from"),
			preset_id: z.string().describe("The preset id to use"),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Override source UID for the active note (writes to frontmatter if different).",
				),
		},
	),
];
