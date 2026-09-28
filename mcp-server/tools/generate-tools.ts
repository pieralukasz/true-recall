import { z } from "zod";

import { get, postParams, type ToolDef } from "./_register.js";

export const generateTools: ToolDef[] = [
	postParams(
		"generate_flashcards",
		"Generate flashcards from text with the AI provider configured in the plugin and save them at once. The text is sent to that provider. Cards are linked to source_uid; without it they go to the note open in Obsidian, whose frontmatter gets a flashcard_uid if it has none. It does not skip duplicates. Fails with 400 when AI generation isn't configured. Returns created and the new cards. Write the cards yourself with create_flashcards_batch when you already know what they should say.",
		"/generate",
		{
			text: z
				.string()
				.describe(
					"The source text to generate flashcards from (note content, code explanation, documentation, etc.)",
				),
			note_type_slug: z
				.string()
				.optional()
				.describe(
					"Note type slug from get_note_types (e.g. 'basic', 'cloze'); defaults to basic, and an unknown slug also falls back to basic",
				),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Source note UID to link cards to (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6'). If omitted, links to the currently active note.",
				),
		},
	),

	get(
		"get_note_types",
		"List the note types (card templates) with their id, slug and fields, e.g. Basic has Front/Back and Cloze has Text/Extra. generate_flashcards takes the slug; generation presets take the id.",
		"/note-types",
	),
];
