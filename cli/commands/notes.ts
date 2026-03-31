import type { CommandDef } from "../registry.js";
import { post, postParams } from "../registry.js";

const C = "Notes";

export const noteCommands: CommandDef[] = [
	post(
		"add_flashcard_uid",
		"Add a flashcard_uid to the active note's frontmatter. Returns existing UID if one exists.",
		C,
		"/notes/add-uid",
	),

	postParams(
		"set_note_preset",
		"Assign an FSRS preset to a note. Pass null preset_name to remove override.",
		C,
		"/notes/set-preset",
		{
			preset_name: {
				type: "string",
				description: "Preset name, or null to remove override",
				required: true,
			},
			path: {
				type: "string",
				description: "Note file path. If omitted, uses active note.",
			},
		},
	),

	postParams(
		"set_note_parent",
		"Add or remove a parent project for a note",
		C,
		"/notes/set-parent",
		{
			parent_name: {
				type: "string",
				description: "Name of the parent project note (without .md)",
				required: true,
			},
			action: {
				type: "string",
				description: "Add or remove the parent",
				required: true,
				enum: ["add", "remove"],
			},
			path: {
				type: "string",
				description: "Note file path. If omitted, uses active note.",
			},
		},
	),

	postParams(
		"set_note_archive",
		"Archive or unarchive a note. Archived notes are hidden from review and dashboard.",
		C,
		"/notes/set-archive",
		{
			archived: {
				type: "boolean",
				description: "true to archive, false to unarchive",
				required: true,
			},
			path: {
				type: "string",
				description: "Note file path. If omitted, uses active note.",
			},
		},
	),
];
