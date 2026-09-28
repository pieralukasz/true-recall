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
		"List flashcards, optionally filtered by a case-insensitive substring of the question or answer, by card state, or by source note. Returns total (all matches) and up to limit cards, in no particular order. Suspended cards and cards from archived notes are left out unless suspended / archived is true. It does not filter by due date (use get_due_cards) and does not understand Card Browser syntax such as 'flag:2'.",
		{
			query: z
				.string()
				.optional()
				.describe("Case-insensitive substring to find in question or answer"),
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
				.int()
				.min(1)
				.max(200)
				.optional()
				.default(50)
				.describe("Max cards to return (1-200)"),
			suspended: z
				.boolean()
				.optional()
				.describe("Include suspended cards (default false)"),
			archived: z
				.boolean()
				.optional()
				.describe("Include cards from archived notes (default false)"),
		},
		async (params, client) => {
			const sp = new URLSearchParams();
			if (typeof params.query === "string") sp.set("q", params.query);
			if (typeof params.state === "string") sp.set("state", params.state);
			if (typeof params.source_uid === "string")
				sp.set("source_uid", params.source_uid);
			if (typeof params.limit === "number")
				sp.set("limit", String(params.limit));
			if (params.suspended === true) sp.set("suspended", "true");
			if (params.archived === true) sp.set("archived", "true");
			const qs = sp.toString();
			return jsonResult(await client.get(`/cards${qs ? `?${qs}` : ""}`));
		},
	),

	getWith(
		"get_actual_learning_cards",
		"Get cards currently in Learning or Relearning, soonest due first, with actualLearningCount (all such cards) and showing. Excludes suspended, buried and archived cards.",
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
		"Get a single flashcard with full details, the user's userComment, and review history",
		{
			card_id: z.string().describe("The card's UUID"),
		},
		(p) => `/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}`,
	),

	getWith(
		"get_card_context",
		"Get deep context for a flashcard: the card including the user's userComment, full FSRS data, complete review history, source note, and sibling cards. Use userComment as the user's verification concern or thought, not as authoritative source material.",
		{ card_id: z.string().describe("The card's UUID") },
		(p) =>
			`/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}/context`,
	),

	getWith(
		"get_card_relations",
		"Get all related cards for a flashcard: sibling cards from the same note, reverse card pairs, and cloze siblings (same template, different deletions). Use this to understand how a card fits within its note and find related content.",
		{ card_id: z.string().describe("The card's UUID") },
		(p) =>
			`/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}/relations`,
	),

	postParams(
		"create_flashcard",
		"Create one flashcard as a new card; it appears in Obsidian right away and is recorded as created_via='claude_code'. It is linked to the note given by source_uid; without source_uid it has no source note (it is not linked to the open note). For several cards use create_flashcards_batch. Returns created and cardIds.",
		"/cards",
		{
			question: z.string().describe("The question (front of card)"),
			answer: z.string().describe("The answer (back of card)"),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6'); add_flashcard_uid creates one for the open note",
				),
			source_text: z
				.string()
				.optional()
				.describe("Original text that generated this card"),
			card_type: z
				.enum(["basic", "cloze"])
				.optional()
				.default("basic")
				.describe(
					"basic: question/answer. cloze: question holds the cloze text, e.g. 'Paris is the capital of {{c1::France}}', and answer the extra field",
				),
		},
	),

	postParams(
		"create_flashcards_batch",
		"Create several flashcards in one call, all linked to source_uid when given, recorded as created_via='claude_code'. Every card needs a non-empty question and an answer string; if any card fails that check the call returns 400 and creates nothing. Returns created and cardIds in input order.",
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
						card_type: z
							.enum(["basic", "cloze"])
							.optional()
							.describe("basic (default) or cloze"),
					}),
				)
				.min(1)
				.describe("Flashcards to create"),
			source_uid: z
				.string()
				.optional()
				.describe(
					"Source note UID to link all cards to (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6')",
				),
		},
	),
];
