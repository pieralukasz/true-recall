import { z } from "zod";
import { del, postParams, postTo, type ToolDef } from "./_register.js";

export const sessionTools: ToolDef[] = [
	postParams(
		"start_review_session",
		"Open a review session in Obsidian. This activates the ReviewView in the Obsidian UI with the specified mode and filters. Modes: all_due (standard daily review), current_note (review active note's cards), weak_cards (low stability), created_today (new cards from today), overdue (past due), custom (advanced filters).",
		"/sessions/start",
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
				.describe(
					"For custom mode: source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6')",
				),
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
	),

	postTo(
		"suspend_card",
		"Suspend or unsuspend a flashcard. Suspended cards are excluded from all review sessions.",
		{
			card_id: z.string().describe("The card's UUID"),
			suspended: z.boolean().describe("true to suspend, false to unsuspend"),
		},
		(p) => `/cards/${p.card_id}/suspend`,
		({ suspended }) => ({ suspended }),
	),

	postTo(
		"update_card",
		"Edit a flashcard's question and/or answer content. Updates the underlying note fields and recomputes card content.",
		{
			card_id: z.string().describe("The card's UUID"),
			question: z.string().optional().describe("New question/front text"),
			answer: z.string().optional().describe("New answer/back text"),
		},
		(p) => `/cards/${p.card_id}/update`,
		({ question, answer }) => ({ question, answer }),
	),

	del(
		"delete_card",
		"Permanently delete a flashcard. This soft-deletes the card — it won't appear in reviews or searches.",
		{ card_id: z.string().describe("The card's UUID") },
		(p) => `/cards/${p.card_id}`,
	),

	postParams(
		"bulk_delete_cards",
		"Delete multiple flashcards at once by their IDs.",
		"/cards/bulk-delete",
		{
			card_ids: z.array(z.string()).describe("Array of card UUIDs to delete"),
		},
	),

	postParams(
		"remove_cards_from_note",
		"Delete ALL flashcards linked to a specific note. Can target by source_uid, vault path, or defaults to the active note.",
		"/cards/remove-from-note",
		{
			source_uid: z
				.string()
				.optional()
				.describe(
					"Source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6'). If omitted, uses path or active note.",
				),
			path: z
				.string()
				.optional()
				.describe(
					"Vault path to the note (e.g. 'Folder/Note.md'). If omitted, uses active note.",
				),
		},
	),

	postParams(
		"bulk_suspend_cards",
		"Suspend or unsuspend multiple cards at once. Suspended cards are excluded from review sessions.",
		"/cards/bulk-suspend",
		{
			card_ids: z.array(z.string()).describe("Array of card UUIDs"),
			suspended: z.boolean().describe("true to suspend, false to unsuspend"),
		},
	),

	postParams(
		"bury_cards",
		"Temporarily hide cards until a specific date or for N days. Buried cards auto-unbury after the date passes. Default: 1 day (next day boundary at 4 AM).",
		"/cards/bulk-bury",
		{
			card_ids: z.array(z.string()).describe("Array of card UUIDs to bury"),
			days: z
				.number()
				.optional()
				.describe(
					"Number of days to bury (default 1). Ignored if 'until' is set.",
				),
			until: z
				.string()
				.optional()
				.describe(
					"Bury until this ISO date (e.g. '2026-04-01'). Takes priority over days.",
				),
		},
	),
];
