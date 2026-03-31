import type { CommandDef } from "../registry.js";
import { postParams } from "../registry.js";

const C = "Navigation";

export const navigationCommands: CommandDef[] = [
	postParams(
		"open_view",
		"Open a True Recall view in Obsidian: dashboard, stats, card-browser, card-browser-orphaned, flashcard-panel, simulator",
		C,
		"/open-view",
		{
			view: {
				type: "string",
				description: "Which view to open",
				required: true,
				enum: [
					"dashboard",
					"stats",
					"card-browser",
					"card-browser-orphaned",
					"flashcard-panel",
					"simulator",
				],
			},
			source_uid: {
				type: "string",
				description:
					"For card-browser: source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6')",
			},
		},
	),

	postParams(
		"open_note",
		"Open a specific note in Obsidian by its vault path",
		C,
		"/open-note",
		{
			path: {
				type: "string",
				description: "Vault-relative path to the note (e.g. 'Projects/ML.md')",
				required: true,
			},
		},
	),
];
