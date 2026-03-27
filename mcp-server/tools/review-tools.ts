import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerReviewTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"get_due_cards",
		{
			description:
				"Get flashcards due for review today. Use this to start a CLI review session — show the question, let the user answer, then grade with grade_card.",
		},
		async () => {
			const data = await client.get("/cards/due");
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.registerTool(
		"grade_card",
		{
			description:
				"Submit a review rating for a flashcard. This updates the FSRS scheduling in real-time — the plugin's UI reflects changes instantly. Rating: 1=Again (forgot), 2=Hard, 3=Good, 4=Easy.",
			inputSchema: {
				card_id: z.string().describe("The card's UUID"),
				rating: z
					.number()
					.min(1)
					.max(4)
					.describe("Rating: 1=Again (forgot), 2=Hard, 3=Good, 4=Easy"),
			},
		},
		async (params) => {
			const data = await client.post(`/cards/${params.card_id}/review`, {
				rating: params.rating,
			});
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);
}
