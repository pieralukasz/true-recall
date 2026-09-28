import { z } from "zod";

import {
	getWith,
	post,
	postParams,
	type ToolDef,
	withQuery,
} from "./_register.js";

const notePath = z
	.string()
	.optional()
	.describe(
		"Vault path of the note, e.g. 'Folder/Note.md'; default: the note open in Obsidian",
	);
const noteSourceUid = z
	.string()
	.optional()
	.describe("The note's flashcard_uid; takes priority over path");

export const noteTools: ToolDef[] = [
	post(
		"add_flashcard_uid",
		"Give the note open in Obsidian a flashcard_uid in its frontmatter, the ID that links cards to a note (source_uid in other tools). Returns uid and alreadyExisted; an existing UID is returned unchanged. Fails with 404 when no markdown note is open.",
		"/notes/add-uid",
	),

	postParams(
		"set_note_preset",
		"Assign an FSRS preset to a note (default: the note open in Obsidian), so its cards are scheduled with that preset instead of the default; pass preset_name null to go back to the default. Fails with 404 for an unknown preset name or note.",
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
		"Add a parent project to a note or remove one (default: the note open in Obsidian). Projects are notes that group other notes into the deck tree shown on the dashboard; a note can have several parents. The link is stored in the note's frontmatter.",
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
		"Archive or unarchive a note (default: the note open in Obsidian). Archived notes and their cards are hidden from the dashboard and review sessions but keep their history; unarchiving brings them back. Stored in the note's frontmatter.",
		"/notes/set-archive",
		{
			archived: z.boolean().describe("true to archive, false to unarchive"),
			path: z
				.string()
				.optional()
				.describe("Note file path. If omitted, uses the active note."),
		},
	),

	postParams(
		"dissolve_project",
		"Dissolve a project: remove the link to it from every child note, which then have no parent from this project. There is no call to undo it except re-adding each parent with set_note_parent. Returns dissolved, the number of children changed; fails with 404 when the project has no children.",
		"/notes/dissolve-project",
		{
			path: z.string().describe("Project note file path"),
		},
	),

	postParams(
		"move_project_children",
		"Move every child note of one project to another project: each child loses the old parent and gains the new one. Returns moved; fails with 404 when the project has no children.",
		"/notes/move-children",
		{
			path: z.string().describe("Source project note file path"),
			target_parent_name: z
				.string()
				.describe("Name of the target project note (without .md)"),
		},
	),

	postParams(
		"toggle_note_review",
		"Turn whole-note review on or off for a note (default: the note open in Obsidian). On adds one card that schedules re-reading the whole note; off deletes that card and its review history, which this API cannot restore. Returns path and noteReview, the new state; check it first with note_review_status.",
		"/notes/note-review/toggle",
		{ path: notePath },
	),

	postParams(
		"note_review_status",
		"Check whether whole-note review is on for a note (default: the note open in Obsidian). Returns path, noteReview and sourceUid.",
		"/notes/note-review/status",
		{ path: notePath },
	),

	getWith(
		"note_stats",
		"Count one note's cards by state: new, learning, review, relearning, suspended, buried and total. The note is chosen by source_uid, else path, else the note open in Obsidian. Fails with 404 when the note has no flashcard_uid.",
		{ path: notePath, source_uid: noteSourceUid },
		(p) =>
			withQuery(
				"/notes/stats",
				p.source_uid ? { source_uid: p.source_uid } : { path: p.path },
			),
	),

	getWith(
		"note_cards",
		"List one note's cards with scheduling details (state, due, stability, difficulty, reps, lapses): total plus up to limit cards. The note is chosen by source_uid, else path, else the note open in Obsidian.",
		{
			path: notePath,
			source_uid: noteSourceUid,
			state: z
				.enum(["new", "learning", "review", "relearning"])
				.optional()
				.describe("Only cards in this state"),
			limit: z
				.number()
				.int()
				.min(1)
				.max(200)
				.optional()
				.default(50)
				.describe("Max cards to return (1-200)"),
		},
		(p) =>
			withQuery("/notes/cards", {
				...(p.source_uid ? { source_uid: p.source_uid } : { path: p.path }),
				state: p.state,
				limit: p.limit,
			}),
	),
];
