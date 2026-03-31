import type { CommandDef } from "../registry.js";
import { custom, get, getWith, postParams } from "../registry.js";

const C = "Cards";

export const cardCommands: CommandDef[] = [
	custom(
		"list_cards",
		"Search and list flashcards with optional filtering by query text, state, source note, and sorting",
		C,
		{
			query: { type: "string", description: "Text search in question/answer" },
			state: {
				type: "string",
				description: "Filter by card state",
				enum: ["new", "learning", "review", "relearning"],
			},
			source_uid: { type: "string", description: "Filter by source note UID" },
			limit: {
				type: "number",
				description: "Max cards to return (max 200)",
				default: 50,
			},
			suspended: {
				type: "boolean",
				description: "Include suspended cards",
			},
			archived: {
				type: "boolean",
				description: "Include archived cards",
			},
		},
		async (params, client) => {
			const sp = new URLSearchParams();
			if (params.query) sp.set("q", String(params.query));
			if (params.state) sp.set("state", String(params.state));
			if (params.source_uid) sp.set("source_uid", String(params.source_uid));
			if (params.limit) sp.set("limit", String(params.limit));
			if (params.suspended) sp.set("suspended", "true");
			if (params.archived) sp.set("archived", "true");
			const qs = sp.toString();
			return client.get(`/cards${qs ? `?${qs}` : ""}`);
		},
	),

	getWith(
		"get_card",
		"Get a single flashcard with full details and review history",
		C,
		{
			card_id: {
				type: "string",
				description: "The card's UUID",
				required: true,
			},
		},
		(p) => `/cards/${p.card_id}`,
	),

	getWith(
		"get_card_context",
		"Get deep context for a flashcard: card with FSRS data, review history, source note content, sibling cards",
		C,
		{
			card_id: {
				type: "string",
				description: "The card's UUID",
				required: true,
			},
		},
		(p) => `/cards/${p.card_id}/context`,
	),

	getWith(
		"get_card_relations",
		"Get related cards: siblings from same note, reverse pairs, cloze siblings",
		C,
		{
			card_id: {
				type: "string",
				description: "The card's UUID",
				required: true,
			},
		},
		(p) => `/cards/${p.card_id}/relations`,
	),

	get(
		"get_due_cards",
		"Get all cards due for review today. WARNING: can return 100k+ chars",
		C,
		"/cards/due",
	),

	getWith(
		"get_problem_cards",
		"Identify leech cards — high lapses (>3), low stability (<2d), or relearning state",
		C,
		{
			limit: {
				type: "number",
				description: "Max number of problem cards to return",
				default: 20,
			},
		},
		(p) => `/cards/problems?limit=${p.limit}`,
	),

	postParams(
		"create_flashcard",
		"Create a new flashcard (question/answer pair)",
		C,
		"/cards",
		{
			question: {
				type: "string",
				description: "The question (front of card)",
				required: true,
			},
			answer: {
				type: "string",
				description: "The answer (back of card)",
				required: true,
			},
			source_uid: { type: "string", description: "Source note UID to link to" },
			source_text: {
				type: "string",
				description: "Original text that generated this card",
			},
			card_type: {
				type: "string",
				description: "Card type",
				enum: ["basic", "cloze"],
				default: "basic",
			},
		},
	),

	postParams(
		"create_flashcards_batch",
		"Create multiple flashcards at once",
		C,
		"/cards",
		{
			cards: {
				type: "json",
				description:
					"JSON array of {question, answer, source_text?, card_type?}",
				required: true,
			},
			source_uid: {
				type: "string",
				description: "Source note UID to link all cards to",
			},
		},
	),
];
