import { z } from "zod";
import { post, postParams, type ToolDef } from "./_register.js";

export const noteTools: ToolDef[] = [
	post(
		"add_flashcard_uid",
		"Add a flashcard_uid to the currently active note's frontmatter. This UID links the note to its flashcards. Returns the existing UID if one already exists.",
		"/notes/add-uid",
	),

	postParams(
		"set_note_preset",
		"Assign an FSRS preset to a note (or the active note). This overrides the default scheduling parameters for all flashcards linked to this note. Pass null to remove the override.",
		"/notes/set-preset",
		{
			preset_name: z
				.string()
				.nullable()
				.describe(
					"Preset name to assign (use get_fsrs_presets to see available ones), or null to remove override",
				),
			path: z
				.string()
				.optional()
				.describe(
					"Note file path. If omitted, uses the currently active note.",
				),
		},
	),

	postParams(
		"set_note_parent",
		"Add or remove a parent project for a note. Projects organize notes into a hierarchy (deck structure) visible on the dashboard.",
		"/notes/set-parent",
		{
			parent_name: z
				.string()
				.describe("Name of the parent project note (without .md)"),
			action: z.enum(["add", "remove"]).describe("Add or remove the parent"),
			path: z
				.string()
				.optional()
				.describe("Note file path. If omitted, uses the active note."),
		},
	),

	postParams(
		"set_note_archive",
		"Archive or unarchive a note. Archived notes and their flashcards are hidden from the dashboard and review sessions.",
		"/notes/set-archive",
		{
			archived: z.boolean().describe("true to archive, false to unarchive"),
			path: z
				.string()
				.optional()
				.describe("Note file path. If omitted, uses the active note."),
		},
	),
];
