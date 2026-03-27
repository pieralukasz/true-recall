import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerNoteTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"add_flashcard_uid",
		{
			description:
				"Add a flashcard_uid to the currently active note's frontmatter. This UID links the note to its flashcards. Returns the existing UID if one already exists.",
		},
		async () => {
			const data = await client.post("/notes/add-uid", {});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"set_note_preset",
		{
			description:
				"Assign an FSRS preset to a note (or the active note). This overrides the default scheduling parameters for all flashcards linked to this note. Pass null to remove the override.",
			inputSchema: {
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
		},
		async (params) => {
			const data = await client.post("/notes/set-preset", {
				preset_name: params.preset_name,
				path: params.path,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"set_note_parent",
		{
			description:
				"Add or remove a parent project for a note. Projects organize notes into a hierarchy (deck structure) visible on the dashboard.",
			inputSchema: {
				parent_name: z
					.string()
					.describe("Name of the parent project note (without .md)"),
				action: z.enum(["add", "remove"]).describe("Add or remove the parent"),
				path: z
					.string()
					.optional()
					.describe("Note file path. If omitted, uses the active note."),
			},
		},
		async (params) => {
			const data = await client.post("/notes/set-parent", {
				parent_name: params.parent_name,
				action: params.action,
				path: params.path,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"set_note_archive",
		{
			description:
				"Archive or unarchive a note. Archived notes and their flashcards are hidden from the dashboard and review sessions.",
			inputSchema: {
				archived: z.boolean().describe("true to archive, false to unarchive"),
				path: z
					.string()
					.optional()
					.describe("Note file path. If omitted, uses the active note."),
			},
		},
		async (params) => {
			const data = await client.post("/notes/set-archive", {
				archived: params.archived,
				path: params.path,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);
}
