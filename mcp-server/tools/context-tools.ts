import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TrueRecallClient } from "../client.js";

export function registerContextTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"get_status",
		{
			description:
				"Check if the True Recall plugin is running and the database is ready",
		},
		async () => {
			try {
				const data = await client.get<{
					running: boolean;
					dbReady: boolean;
					vault: string;
				}>("/status");
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch {
				return {
					content: [
						{
							type: "text" as const,
							text: "True Recall plugin is not running or the local API is not enabled. Enable it in Settings → Advanced → Local API.",
						},
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"get_active_note",
		{
			description:
				"Get the currently open note in Obsidian with its content and associated flashcards",
		},
		async () => {
			const data = await client.get<{
				path: string;
				basename: string;
				content: string;
				sourceUid?: string;
				cardCount: number;
				cards: Array<{
					id: string;
					question: string;
					answer: string;
					state: number;
					due: string;
					reps: number;
					lapses: number;
				}>;
			}>("/active-note");
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
			};
		},
	);
}
