import type { CommandDef } from "../registry.js";
import { getWith, post, postParams } from "../registry.js";

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

	postParams(
		"dissolve_project",
		"Dissolve a project by removing all parent references from its children. Children become unassigned.",
		C,
		"/notes/dissolve-project",
		{
			path: {
				type: "string",
				description: "Project note file path",
				required: true,
			},
		},
	),

	postParams(
		"move_project_children",
		"Move all children from one project to another. Removes old parent and adds new parent for each child.",
		C,
		"/notes/move-children",
		{
			path: {
				type: "string",
				description: "Source project note file path",
				required: true,
			},
			target_parent_name: {
				type: "string",
				description: "Name of the target project note (without .md)",
				required: true,
			},
		},
	),

	postParams(
		"toggle_note_review",
		"Toggle whole-note spaced repetition review for a note. Creates or removes the note-review card.",
		C,
		"/notes/note-review/toggle",
		{
			path: {
				type: "string",
				description: "Note file path. If omitted, uses active note.",
			},
		},
	),

	postParams(
		"note_review_status",
		"Check whether whole-note review is enabled for a note.",
		C,
		"/notes/note-review/status",
		{
			path: {
				type: "string",
				description: "Note file path. If omitted, uses active note.",
			},
		},
	),

	getWith(
		"note_stats",
		"Get card count breakdown by state for a note: new, learning, review, relearning, suspended, buried, total.",
		C,
		{
			path: {
				type: "string",
				description: "Note file path. If omitted, uses active note.",
			},
			source_uid: {
				type: "string",
				description: "Source UID (flashcard_uid) of the note.",
			},
		},
		(p) => {
			const params = new URLSearchParams();
			if (p.source_uid) params.set("source_uid", String(p.source_uid));
			else if (p.path) params.set("path", String(p.path));
			const qs = params.toString();
			return qs ? `/notes/stats?${qs}` : "/notes/stats";
		},
	),

	getWith(
		"note_cards",
		"List cards belonging to a note with scheduling details: state, due, stability, difficulty, reps, lapses.",
		C,
		{
			path: {
				type: "string",
				description: "Note file path. If omitted, uses active note.",
			},
			source_uid: {
				type: "string",
				description: "Source UID (flashcard_uid) of the note.",
			},
			state: {
				type: "string",
				description: "Filter by state",
				enum: ["new", "learning", "review", "relearning"],
			},
			limit: {
				type: "number",
				description: "Max cards to return (default 50, max 200)",
				default: 50,
			},
		},
		(p) => {
			const params = new URLSearchParams();
			if (p.source_uid) params.set("source_uid", String(p.source_uid));
			else if (p.path) params.set("path", String(p.path));
			if (p.state) params.set("state", String(p.state));
			if (p.limit) params.set("limit", String(p.limit));
			const qs = params.toString();
			return qs ? `/notes/cards?${qs}` : "/notes/cards";
		},
	),
];
