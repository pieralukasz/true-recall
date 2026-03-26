import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerSessionTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.tool(
		"start_review_session",
		"Open a review session in Obsidian. This activates the ReviewView in the Obsidian UI with the specified mode and filters. Modes: all_due (standard daily review), current_note (review active note's cards), weak_cards (low stability), created_today (new cards from today), overdue (past due), custom (advanced filters).",
		{
			mode: z
				.enum([
					"all_due",
					"current_note",
					"weak_cards",
					"created_today",
					"overdue",
					"custom",
				])
				.optional()
				.default("all_due")
				.describe("Review session mode"),
			source_uid: z
				.string()
				.optional()
				.describe("For custom mode: scope to a specific source note"),
			card_limit: z
				.number()
				.optional()
				.describe("For custom mode: max number of cards in session"),
			state_filter: z
				.enum(["due", "learning", "new", "buried"])
				.optional()
				.describe("For custom mode: filter by card state"),
			overdue_only: z
				.boolean()
				.optional()
				.describe("For custom mode: only show overdue cards"),
			recently_failed: z
				.boolean()
				.optional()
				.describe("For custom mode: only cards rated Again recently"),
			cramming: z
				.boolean()
				.optional()
				.describe("For custom mode: cramming mode (bypass scheduling)"),
		},
		async (params) => {
			const data = await client.post("/sessions/start", {
				mode: params.mode,
				source_uid: params.source_uid,
				card_limit: params.card_limit,
				state_filter: params.state_filter,
				overdue_only: params.overdue_only,
				recently_failed: params.recently_failed,
				cramming: params.cramming,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.tool(
		"suspend_card",
		"Suspend or unsuspend a flashcard. Suspended cards are excluded from all review sessions.",
		{
			card_id: z.string().describe("The card's UUID"),
			suspended: z
				.boolean()
				.describe("true to suspend, false to unsuspend"),
		},
		async (params) => {
			const data = await client.post(
				`/cards/${params.card_id}/suspend`,
				{ suspended: params.suspended },
			);
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.tool(
		"update_card",
		"Edit a flashcard's question and/or answer content. Updates the underlying note fields and recomputes card content.",
		{
			card_id: z.string().describe("The card's UUID"),
			question: z
				.string()
				.optional()
				.describe("New question/front text"),
			answer: z.string().optional().describe("New answer/back text"),
		},
		async (params) => {
			const data = await client.post(
				`/cards/${params.card_id}/update`,
				{ question: params.question, answer: params.answer },
			);
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.tool(
		"delete_card",
		"Permanently delete a flashcard. This soft-deletes the card — it won't appear in reviews or searches.",
		{
			card_id: z.string().describe("The card's UUID"),
		},
		async (params) => {
			const data = await client.delete(`/cards/${params.card_id}`);
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);
}
