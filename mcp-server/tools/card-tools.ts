import { z } from "zod";

import {
	custom,
	getWith,
	jsonResult,
	postParams,
	requireStringParam,
	type ToolDef,
} from "./_register.js";

export const cardTools: ToolDef[] = [
	custom(
		"list_cards",
		"Search and list flashcards with optional filtering by query text, state, source note, and sorting",
		{
			query: z.string().optional().describe("Text search in question/answer"),
			state: z
				.enum(["new", "learning", "review", "relearning", "actual-learning"])
				.optional()
				.describe(
					"Filter by card state; actual-learning combines Learning and Relearning",
				),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Filter by source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6')",
				),
			limit: z
				.number()
				.optional()
				.default(50)
				.describe("Max cards to return (max 200)"),
		},
		async (params, client) => {
			const sp = new URLSearchParams();
			if (typeof params.query === "string") sp.set("q", params.query);
			if (typeof params.state === "string") sp.set("state", params.state);
			if (typeof params.source_uid === "string")
				sp.set("source_uid", params.source_uid);
			if (typeof params.limit === "number")
				sp.set("limit", String(params.limit));
			const qs = sp.toString();
			return jsonResult(await client.get(`/cards${qs ? `?${qs}` : ""}`));
		},
	),

	getWith(
		"get_actual_learning_cards",
		"Get active cards currently in Learning or Relearning, ordered by due date. Excludes suspended, buried, and archived cards.",
		{
			limit: z
				.number()
				.int()
				.min(1)
				.max(200)
				.optional()
				.default(50)
				.describe("Max cards to return (1-200)"),
		},
		(p) => `/cards/actual-learning?limit=${String(p.limit)}`,
	),

	getWith(
		"get_card",
		"Get a single flashcard with full details and review history",
		{
			card_id: z.string().describe("The card's UUID"),
		},
		(p) => `/cards/${requireStringParam(p, "card_id")}`,
	),

	getWith(
		"get_card_context",
		"Get deep context for a flashcard: the card with full FSRS data, its complete review history, the full markdown content of the source note, and all sibling cards from the same note. Use this to understand a card's topic in depth — for explaining, tutoring, or diagnosing why a card is difficult.",
		{ card_id: z.string().describe("The card's UUID") },
		(p) => `/cards/${requireStringParam(p, "card_id")}/context`,
	),

	getWith(
		"get_card_relations",
		"Get all related cards for a flashcard: sibling cards from the same note, reverse card pairs, and cloze siblings (same template, different deletions). Use this to understand how a card fits within its note and find related content.",
		{ card_id: z.string().describe("The card's UUID") },
		(p) => `/cards/${requireStringParam(p, "card_id")}/relations`,
	),

	postParams(
		"create_flashcard",
		"Create a new flashcard. Goes through the plugin's proper creation flow with FSRS initialization and signal notifications. The card appears instantly in Obsidian.",
		"/cards",
		{
			question: z.string().describe("The question (front of card)"),
			answer: z.string().describe("The answer (back of card)"),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6')",
				),
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
	),

	postParams(
		"create_flashcards_batch",
		"Create multiple flashcards at once. Useful for bulk generation from code, documentation, or notes. All cards are tracked as created_via='claude_code'.",
		"/cards",
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
						card_type: z.enum(["basic", "cloze"]).optional().default("basic"),
					}),
				)
				.describe("Array of flashcards to create"),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Source note UID to link all cards to (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6')",
				),
		},
	),
];
