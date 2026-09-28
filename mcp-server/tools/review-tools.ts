import { z } from "zod";

import {
	getWith,
	post,
	postParams,
	postTo,
	requireStringParam,
	type ToolDef,
	withQuery,
} from "./_register.js";

export const reviewTools: ToolDef[] = [
	getWith(
		"get_review_context",
		"Get the active review session in detail: the card being reviewed (question, answer, the user's userComment, FSRS state), isAnswerRevealed, session progress, badge counts and, by default, the source note's markdown. Returns active: false with phase idle or complete when no card is being reviewed. The answer is included even before it is revealed, so follow the server's answer-privacy rule. Use userComment as the user's own note, not as source material. get_full_context gives a cheaper overview.",
		{
			include_note_content: z
				.boolean()
				.optional()
				.default(true)
				.describe(
					"Include the full markdown content of the source note (default: true)",
				),
		},
		(p) =>
			`/review/current${p.include_note_content ? "?include_note_content=true" : ""}`,
	),

	getWith(
		"get_due_cards",
		"Get flashcards due today: dueCount (all due cards), noteBreakdown (the 20 notes with the most due cards) and up to limit cards with question, answer and FSRS fields. Cards from archived notes are left out unless archived is true. For the due count alone, get_full_context or get_dashboard is cheaper.",
		{
			limit: z
				.number()
				.int()
				.min(1)
				.optional()
				.default(50)
				.describe(
					"Max cards to return (default 50); dueCount still counts every due card",
				),
			archived: z
				.boolean()
				.optional()
				.describe("Include cards from archived notes (default false)"),
		},
		(p) => withQuery("/cards/due", { limit: p.limit, archived: p.archived }),
	),

	post(
		"reveal_answer",
		"Flip the current review card in Obsidian and return its question and answer. Call it when the user asks to see the answer ('show me', 'flip', 'pokaż odpowiedź', 'I give up'); after that you can discuss the answer freely. Fails with 404 when no review card is active.",
		"/review/reveal",
	),

	postParams(
		"grade_review_card",
		"Grade the current review card with the user's rating and move the session to the next card; Obsidian updates at once. The rating is saved to the review history and reschedules the card; this API cannot undo it, so use the rating the user chose. Returns the grading result, session progress and the next card's question. Fails with 404 when no review card is active.",
		"/review/grade",
		{
			rating: z
				.number()
				.int()
				.min(1)
				.max(4)
				.describe("1=Again (forgot), 2=Hard, 3=Good, 4=Easy"),
		},
	),

	postTo(
		"grade_card",
		"Grade any flashcard by ID outside a review session. The rating is saved to the review history and reschedules the card; this API cannot undo it. While a session is active use grade_review_card instead, which also advances the session. Returns the new state, due date, stability, difficulty and scheduledDays.",
		{
			card_id: z.string().describe("The card's UUID"),
			rating: z
				.number()
				.int()
				.min(1)
				.max(4)
				.describe("1=Again (forgot), 2=Hard, 3=Good, 4=Easy"),
		},
		(p) =>
			`/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}/review`,
		({ rating }) => ({ rating }),
	),
];
