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
		"List all generation presets. Returns array with each preset's id, name, noteTypeId, fields, tts config, isPinned, isDefault. Use before create/update/delete to see what exists.",
		"/generation-presets",
	),

	getWith(
		"get_generation_preset",
		"Fetch a single generation preset by id. Returns full preset JSON including fields and tts config.",
		{
			preset_id: z
				.string()
				.describe("Preset id (e.g. 'builtin-basic-flashcards' or a UUID)"),
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
	),

	postParams(
		"create_generation_preset",
		"Create a new generation preset. Validation is strict: name non-empty, noteTypeId must exist, every field name must be in the note type's fields, every ai-text field needs a non-empty instruction, every image field's sourceField must be an ai-text field, tts.field must be an ai-text field, tts.voice must be a valid voice, preset must have at least one ai-text field. Body is the full preset JSON minus id/createdAt/updatedAt.",
		"/generation-presets",
		{
			preset: z
				.object({
					name: z.string(),
					noteTypeId: z.string(),
					fields: z.record(z.any()),
					tts: z
						.object({
							field: z.string(),
							voice: z.string(),
							autoplay: z.boolean(),
						})
						.nullable(),
					customPrompt: z.string().optional(),
					isPinned: z.boolean(),
					isDefault: z.boolean(),
				})
				.describe("Full preset JSON minus id/createdAt/updatedAt"),
		},
	),

	postTo(
		"update_generation_preset",
		"Update a generation preset (PATCH semantics). Only provided top-level keys are changed. If fields or tts are provided, they atomically replace the existing sub-object — there is no deep merge. Unknown keys are rejected with 400. Setting isDefault:true auto-unsets default on all other presets. Pro presets (e.g. 'builtin-basic-pro-flashcards') cannot be edited — duplicate them first with duplicate semantics (use list + create).",
		{
			preset_id: z.string().describe("Preset id to update"),
			patch: z
				.object({
					name: z.string().optional(),
					noteTypeId: z.string().optional(),
					fields: z.record(z.any()).optional(),
					tts: z
						.object({
							field: z.string(),
							voice: z.string(),
							autoplay: z.boolean(),
						})
						.nullable()
						.optional(),
					customPrompt: z.string().optional(),
					isPinned: z.boolean().optional(),
					isDefault: z.boolean().optional(),
				})
				.describe("Partial preset JSON"),
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
		(p) => p.patch,
	),

	del(
		"delete_generation_preset",
		"Delete a generation preset. Pro presets (e.g. 'builtin-basic-pro-flashcards') cannot be deleted. Deleting the default preset auto-promotes the next preset to default. Deleting the last preset is blocked.",
		{
			preset_id: z.string().describe("Preset id to delete"),
		},
		(p) => `/generation-presets/${encodeURIComponent(String(p.preset_id))}`,
	),

	postParams(
		"generate_flashcards_with_preset",
		"Generate flashcards from text using a specific preset_id. Preset controls the note type, field instructions, system prompt, TTS, and image generation. Prefer this over generate_flashcards when the user has configured presets. Requires an active markdown note in Obsidian.",
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
