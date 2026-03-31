import type { CommandDef } from "../registry.js";
import { get, postParams } from "../registry.js";

const C = "AI Generation";

export const generateCommands: CommandDef[] = [
	postParams(
		"generate_flashcards",
		"Generate flashcards from text using AI (Pro key or OpenRouter BYOK)",
		C,
		"/generate",
		{
			text: {
				type: "string",
				description: "The source text to generate flashcards from",
				required: true,
			},
			note_type_slug: {
				type: "string",
				description:
					"Note type slug (e.g. 'basic', 'cloze'). Defaults to basic.",
			},
			source_uid: {
				type: "string",
				description:
					"Source note UID to link cards to (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6'). If omitted, links to active note.",
			},
		},
	),

	get(
		"get_note_types",
		"List all available note types (card templates) with their field definitions",
		C,
		"/note-types",
	),
];
