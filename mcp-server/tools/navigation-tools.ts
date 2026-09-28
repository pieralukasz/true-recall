import { z } from "zod";

import { postParams, type ToolDef } from "./_register.js";

export const navigationTools: ToolDef[] = [
	postParams(
		"open_view",
		"Show a True Recall view in Obsidian: dashboard, stats (charts), card-browser (searchable card list, filtered to one note when source_uid is given), card-browser-orphaned (cards without a source note), flashcard-panel (side panel) or simulator (FSRS simulator). Changes only what the user sees.",
		"/open-view",
		{
			view: z
				.enum([
					"dashboard",
					"stats",
					"card-browser",
					"card-browser-orphaned",
					"flashcard-panel",
					"simulator",
				])
				.describe("Which view to open in Obsidian"),
			source_uid: z
				.string()
				.optional()
				.describe(
					"For card-browser: source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6')",
				),
		},
	),

	postParams(
		"open_note",
		"Open a note in Obsidian by vault path; it becomes the active tab, so later tools that default to the open note will use it. Fails with 404 when the file doesn't exist.",
		"/open-note",
		{
			path: z
				.string()
				.describe("Vault-relative path to the note (e.g. 'Projects/ML.md')"),
		},
	),
];
