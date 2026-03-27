import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerReviewTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"get_review_context",
		{
			description:
				"Get detailed review session data: the exact card being reviewed right now (question, answer, FSRS state), whether the answer is revealed, session progress, badge counts, and optionally the full source note content. Use this when the user asks about 'this card', 'current flashcard', or anything about what they're reviewing. Prefer get_full_context first for a quick overview — use this tool when you need deeper review detail like the source note text.",
			inputSchema: {
				include_note_content: z
					.boolean()
					.optional()
					.default(true)
					.describe(
						"Include the full markdown content of the source note (default: true)",
					),
			},
		},
		async (params) => {
			const query = params.include_note_content
				? "?include_note_content=true"
				: "";
			const data = await client.get(`/review/current${query}`);
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"get_due_cards",
		{
			description:
				"Get all flashcards due for review today with full card data. WARNING: this can return very large responses (100k+ characters) if many cards are due. Use get_full_context instead to just see the due count. Only use this tool when you need the actual card list — e.g. to start a CLI review session or analyze specific due cards.",
		},
		async () => {
			const data = await client.get("/cards/due");
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.registerTool(
		"reveal_answer",
		{
			description:
				"Reveal the answer for the current review card in the active Obsidian session. This flips the card in the UI and returns the full card content (question + answer). Call this when the user wants to see the answer, says 'show me', 'flip', 'I give up', etc. After revealing, you can discuss the answer freely.",
		},
		async () => {
			const data = await client.post("/review/reveal");
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"grade_review_card",
		{
			description:
				"Grade the current review card and advance to the next one in the active Obsidian session. Updates FSRS scheduling, records stats, and moves the session forward — the plugin UI updates instantly. Use this during an active review session. Rating: 1=Again (forgot), 2=Hard, 3=Good, 4=Easy. Returns the grading result, updated session progress, and the next card's question.",
			inputSchema: {
				rating: z
					.number()
					.min(1)
					.max(4)
					.describe("Rating: 1=Again (forgot), 2=Hard, 3=Good, 4=Easy"),
			},
		},
		async (params) => {
			const data = await client.post("/review/grade", {
				rating: params.rating,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"grade_card",
		{
			description:
				"Grade any flashcard by ID (standalone, outside of an active review session). For grading the current card in an active review session, use grade_review_card instead — it also advances the session. Rating: 1=Again (forgot), 2=Hard, 3=Good, 4=Easy.",
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
