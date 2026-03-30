import { z } from "zod";
import { get, postParams, type ToolDef } from "./_register.js";

export const generateTools: ToolDef[] = [
	postParams(
		"generate_flashcards",
		"Generate flashcards from text using AI (Pro key or OpenRouter BYOK). Sends text to the configured AI model, parses the response into flashcards, and saves them to the database. If no source_uid is provided, links cards to the currently active note in Obsidian.",
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
					"Note type slug (e.g. 'basic', 'cloze'). Use get_note_types to see available types. Defaults to basic.",
				),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Source note UID to link cards to. If omitted, links to the currently active note.",
				),
		},
	),

	get(
		"get_note_types",
		"List all available note types (card templates). Each note type defines the fields a flashcard has (e.g. Basic has Front/Back, Cloze has Text/Extra). Use this before generate_flashcards to pick the right type.",
		"/note-types",
	),
];
