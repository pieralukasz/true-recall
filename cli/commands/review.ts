import type { CommandDef } from "../registry.js";
import { getWith, post, postParams, postTo } from "../registry.js";

const C = "Review";

export const reviewCommands: CommandDef[] = [
	getWith(
		"get_review_context",
		"Get detailed review session data: current card, answer revealed status, progress, source note content",
		C,
		{
			include_note_content: {
				type: "boolean",
				description: "Include full markdown of source note (default: true)",
				default: true,
			},
		},
		(p) =>
			`/review/current${p.include_note_content ? "?include_note_content=true" : ""}`,
	),

	post(
		"reveal_answer",
		"Reveal the answer for the current review card in the active Obsidian session",
		C,
		"/review/reveal",
	),

	postParams(
		"grade_review_card",
		"Grade current card (1-4) and advance to next in the active session",
		C,
		"/review/grade",
		{
			rating: {
				type: "number",
				description: "Rating: 1=Again, 2=Hard, 3=Good, 4=Easy",
				required: true,
			},
		},
	),

	postTo(
		"grade_card",
		"Grade any flashcard by ID (standalone, outside of active session)",
		C,
		{
			card_id: {
				type: "string",
				description: "The card's UUID",
				required: true,
			},
			rating: {
				type: "number",
				description: "Rating: 1=Again, 2=Hard, 3=Good, 4=Easy",
				required: true,
			},
		},
		(p) => `/cards/${p.card_id}/review`,
		({ rating }) => ({ rating }),
	),
];
