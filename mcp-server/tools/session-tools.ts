import { z } from "zod";

import {
	del,
	postParams,
	postTo,
	requireStringParam,
	type ToolDef,
} from "./_register.js";

export const sessionTools: ToolDef[] = [
	postParams(
		"start_review_session",
		"Open a review session in Obsidian's review view. Modes: all_due (the daily review), current_note (cards of the note open in Obsidian; 404 if it has none), weak_cards (low stability), created_today, overdue, actual_learning (cards in Learning or Relearning, ignoring daily limits), custom (the filters below, ignoring daily limits). The filter params apply only in custom mode; other modes ignore them. Returns started and mode; use get_review_context to read the first card.",
		"/sessions/start",
		{
			mode: z
				.enum([
					"all_due",
					"current_note",
					"weak_cards",
					"created_today",
					"overdue",
					"actual_learning",
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
				.describe("For custom mode: max number of cards in the session"),
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
		"Suspend or unsuspend one flashcard. Suspended cards stay in the collection but are left out of every review session until unsuspended. For several cards use bulk_suspend_cards.",
		{
			card_id: z.string().describe("The card's UUID"),
			suspended: z.boolean().describe("true to suspend, false to unsuspend"),
		},
		(p) =>
			`/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}/suspend`,
		({ suspended }) => ({ suspended }),
	),

	postTo(
		"update_card",
		"Replace a flashcard's question and/or answer text (Front/Back, or Text/Extra for cloze). The old text is overwritten and this API cannot restore it (the user can run 'Undo last flashcard action' in Obsidian), so read the card first with get_card if you need its current text. Pass at least one of question or answer; an empty string is ignored, so a field can't be cleared.",
		{
			card_id: z.string().describe("The card's UUID"),
			question: z.string().optional().describe("New question/front text"),
			answer: z.string().optional().describe("New answer/back text"),
			edit_source: z
				.enum(["manual", "ai"])
				.optional()
				.default("ai")
				.describe(
					"Which edit counter to bump: 'ai' (default) when you wrote the new text, 'manual' when you pass on text the user dictated",
				),
		},
		(p) =>
			`/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}/update`,
		({ question, answer, edit_source }) => ({ question, answer, edit_source }),
	),

	postTo(
		"move_card",
		"Move a flashcard to another Obsidian note by relinking it to that note's flashcard_uid; if the target note has none, one is added to its frontmatter. Returns previousSourceUid and sourceUid, so moving it back undoes the move. Fails with 404 when the target note doesn't exist.",
		{
			card_id: z.string().describe("The card's UUID"),
			target_path: z
				.string()
				.describe(
					"Vault path to the target Markdown note (e.g. 'Folder/Note.md')",
				),
		},
		(p) =>
			`/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}/move`,
		({ target_path }) => ({ target_path }),
	),

	del(
		"delete_card",
		"Delete one flashcard by ID. The card is soft-deleted: it disappears from reviews, searches and the API at once, and this API has no call to restore it (the user can run 'Undo last flashcard action' in Obsidian). Delete only cards the user asked to remove. Fails with 404 if the card is missing or already deleted.",
		{ card_id: z.string().describe("The card's UUID") },
		(p) => `/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}`,
	),

	postParams(
		"bulk_delete_cards",
		"Delete several flashcards by ID, soft-deleted like delete_card with no restore call in this API. Returns deleted (the number of cards removed, which can be lower than the IDs sent) and cardIds. Delete only cards the user asked to remove.",
		"/cards/bulk-delete",
		{
			card_ids: z.array(z.string()).min(1).describe("Card UUIDs to delete"),
		},
	),

	postParams(
		"remove_cards_from_note",
		"Delete ALL flashcards linked to one note, soft-deleted like delete_card with no restore call in this API. The note is chosen by source_uid, else path, else the note open in Obsidian, so pass source_uid or path unless the user means the open note. Returns deleted and the cardIds removed.",
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
		"Suspend or unsuspend several cards in one call. Suspended cards stay in the collection but are left out of every review session. Returns affected, the number of IDs sent.",
		"/cards/bulk-suspend",
		{
			card_ids: z.array(z.string()).min(1).describe("Card UUIDs"),
			suspended: z.boolean().describe("true to suspend, false to unsuspend"),
		},
	),

	postParams(
		"set_card_flag",
		"Set an Anki-style colour flag on one or more cards: 0 removes the flag; 1 red, 2 orange, 3 green, 4 blue, 5 pink, 6 turquoise, 7 purple. The Card Browser search box (open_view card-browser) filters by 'flag:N' or 'flag:red'; list_cards does not understand that syntax. Returns affected.",
		"/cards/bulk-flag",
		{
			card_ids: z.array(z.string()).min(1).describe("Card UUIDs"),
			flag: z.number().int().min(0).max(7).describe("Flag 0-7 (0 removes)"),
		},
	),

	postParams(
		"bury_cards",
		"Hide cards from reviews until a date, then they return by themselves. Without until or days, cards return at 04:00 local time tomorrow; days counts from today and also ends at 04:00. Returns buried and untilDate.",
		"/cards/bulk-bury",
		{
			card_ids: z.array(z.string()).min(1).describe("Card UUIDs to bury"),
			days: z
				.number()
				.int()
				.min(1)
				.optional()
				.describe(
					"Number of days to bury (default 1). Ignored if 'until' is set.",
				),
			until: z
				.string()
				.optional()
				.describe(
					"Bury until this ISO date or date-time (e.g. '2026-04-01'); takes priority over days",
				),
		},
	),
];
