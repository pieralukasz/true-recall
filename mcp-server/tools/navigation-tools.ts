import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerNavigationTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"open_view",
		{
			description:
				"Open a True Recall view in Obsidian. Available views: dashboard (main overview), stats (statistics charts), card-browser (searchable card list), card-browser-orphaned (cards without source note), flashcard-panel (side panel), simulator (FSRS simulator).",
			inputSchema: {
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
					.describe("For card-browser: filter to cards from this source note UID"),
			},
		},
		async (params) => {
			const data = await client.post("/open-view", {
				view: params.view,
				source_uid: params.source_uid,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"open_note",
		{
			description:
				"Open a specific note in Obsidian by its vault path (e.g. 'Folder/My Note.md'). The note becomes the active editor tab.",
			inputSchema: {
				path: z.string().describe("Vault-relative path to the note (e.g. 'Projects/ML.md')"),
			},
		},
		async (params) => {
			const data = await client.post("/open-note", {
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
