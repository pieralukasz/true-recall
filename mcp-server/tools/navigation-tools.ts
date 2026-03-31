import { z } from "zod";
import { postParams, type ToolDef } from "./_register.js";

export const navigationTools: ToolDef[] = [
	postParams(
		"open_view",
		"Open a True Recall view in Obsidian. Available views: dashboard (main overview), stats (statistics charts), card-browser (searchable card list), card-browser-orphaned (cards without source note), flashcard-panel (side panel), simulator (FSRS simulator).",
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
		"Open a specific note in Obsidian by its vault path (e.g. 'Folder/My Note.md'). The note becomes the active editor tab.",
		"/open-note",
		{
			path: z
				.string()
				.describe("Vault-relative path to the note (e.g. 'Projects/ML.md')"),
		},
	),
];
