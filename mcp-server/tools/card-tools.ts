import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerCardTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.tool(
		"list_cards",
		"Search and list flashcards with optional filtering by query text, state, source note, and sorting",
		{
			query: z
				.string()
				.optional()
				.describe("Text search in question/answer"),
			state: z
				.enum(["new", "learning", "review", "relearning"])
				.optional()
				.describe("Filter by card state"),
			source_uid: z
				.string()
				.optional()
				.describe("Filter by source note UID"),
			limit: z
				.number()
				.optional()
				.default(50)
				.describe("Max cards to return (max 200)"),
		},
		async (params) => {
			const searchParams = new URLSearchParams();
			if (params.query) searchParams.set("q", params.query);
			if (params.state) searchParams.set("state", params.state);
			if (params.source_uid) searchParams.set("source_uid", params.source_uid);
			if (params.limit) searchParams.set("limit", String(params.limit));

			const qs = searchParams.toString();
			const data = await client.get(`/cards${qs ? `?${qs}` : ""}`);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.tool(
		"get_card",
		"Get a single flashcard with full details and review history",
		{
			card_id: z.string().describe("The card's UUID"),
		},
		async (params) => {
			const data = await client.get(`/cards/${params.card_id}`);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.tool(
		"create_flashcard",
		"Create a new flashcard. Goes through the plugin's proper creation flow with FSRS initialization and signal notifications. The card appears instantly in Obsidian.",
		{
			question: z.string().describe("The question (front of card)"),
			answer: z.string().describe("The answer (back of card)"),
			source_uid: z
				.string()
				.optional()
				.describe("Source note UID to link this card to an Obsidian note"),
			source_text: z
				.string()
				.optional()
				.describe("Original text that generated this card"),
			card_type: z
				.enum(["basic", "cloze"])
				.optional()
				.default("basic")
				.describe("Card type: basic (Q/A) or cloze (fill-in-the-blank)"),
		},
		async (params) => {
			const data = await client.post("/cards", {
				question: params.question,
				answer: params.answer,
				source_uid: params.source_uid,
				source_text: params.source_text,
				card_type: params.card_type,
			});
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.tool(
		"create_flashcards_batch",
		"Create multiple flashcards at once. Useful for bulk generation from code, documentation, or notes. All cards are tracked as created_via='claude_code'.",
		{
			cards: z
				.array(
					z.object({
						question: z.string().describe("The question"),
						answer: z.string().describe("The answer"),
						source_text: z
							.string()
							.optional()
							.describe("Original text that generated this card"),
						card_type: z
							.enum(["basic", "cloze"])
							.optional()
							.default("basic"),
					}),
				)
				.describe("Array of flashcards to create"),
			source_uid: z
				.string()
				.optional()
				.describe("Source note UID to link all cards to"),
		},
		async (params) => {
			const data = await client.post("/cards", {
				cards: params.cards,
				source_uid: params.source_uid,
			});
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);
}
