import type { CommandDef } from "../registry.js";
import { postParams } from "../registry.js";

const C = "Sessions";

export const sessionCommands: CommandDef[] = [
	postParams(
		"start_review_session",
		"Open a review session in Obsidian. Modes: all_due, current_note, weak_cards, created_today, overdue, actual_learning, custom",
		C,
		"/sessions/start",
		{
			mode: {
				type: "string",
				description: "Review session mode",
				enum: [
					"all_due",
					"current_note",
					"weak_cards",
					"created_today",
					"overdue",
					"actual_learning",
					"custom",
				],
				default: "all_due",
			},
			source_uid: {
				type: "string",
				description:
					"For custom mode: source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6')",
			},
			card_limit: {
				type: "number",
				description: "For custom mode: max number of cards in session",
			},
			state_filter: {
				type: "string",
				description: "For custom mode: filter by card state",
				enum: ["due", "learning", "new", "buried"],
			},
			overdue_only: {
				type: "boolean",
				description: "For custom mode: only show overdue cards",
			},
			recently_failed: {
				type: "boolean",
				description: "For custom mode: only cards rated Again recently",
			},
			cramming: {
				type: "boolean",
				description: "For custom mode: cramming mode (bypass scheduling)",
			},
		},
	),
];
