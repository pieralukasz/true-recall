import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerGenerateTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.tool(
		"generate_flashcards",
		"Generate flashcards from text using AI (Pro key or OpenRouter BYOK). Sends text to the configured AI model, parses the response into flashcards, and saves them to the database. If no source_uid is provided, links cards to the currently active note in Obsidian.",
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
		async (params) => {
			const data = await client.post("/generate", {
				text: params.text,
				note_type_slug: params.note_type_slug,
				source_uid: params.source_uid,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.tool(
		"get_note_types",
		"List all available note types (card templates). Each note type defines the fields a flashcard has (e.g. Basic has Front/Back, Cloze has Text/Extra). Use this before generate_flashcards to pick the right type.",
		{},
		async () => {
			const data = await client.get("/note-types");
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);
}
