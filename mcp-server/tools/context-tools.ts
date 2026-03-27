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
		"get_full_context",
		{
			description:
				"START HERE — always call this first before any other True Recall tool. Returns everything you need to understand the user's current state: which Obsidian view is active (review, editor, browser, etc.), the current review card (if in a session), active note info, today's study stats, and due count. This single call replaces the need to call get_active_note, get_review_context, or get_status separately. Only use those specific tools if you need deeper detail after calling this one.",
		},
		async () => {
			const data = await client.get("/context");
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

	server.registerTool(
		"get_active_note",
		{
			description:
				"Get the full markdown content of the currently open note in Obsidian, plus its associated flashcards. Use ONLY when you need the actual note text (e.g. to generate flashcards from it or analyze its content). For just knowing which note is open, use get_full_context instead — it's faster and includes note metadata without the full content.",
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
