import type { CommandDef } from "../registry.js";
import { del, postParams, postTo } from "../registry.js";

const C = "Card Actions";

export const cardActionCommands: CommandDef[] = [
	postTo(
		"suspend_card",
		"Suspend or unsuspend a flashcard",
		C,
		{
			card_id: {
				type: "string",
				description: "The card's UUID",
				required: true,
			},
			suspended: {
				type: "boolean",
				description: "true to suspend, false to unsuspend",
				required: true,
			},
		},
		(p) => `/cards/${p.card_id}/suspend`,
		({ suspended }) => ({ suspended }),
	),

	postTo(
		"update_card",
		"Edit a flashcard's question and/or answer",
		C,
		{
			card_id: {
				type: "string",
				description: "The card's UUID",
				required: true,
			},
			question: { type: "string", description: "New question/front text" },
			answer: { type: "string", description: "New answer/back text" },
		},
		(p) => `/cards/${p.card_id}/update`,
		({ question, answer }) => ({ question, answer }),
	),

	del(
		"delete_card",
		"Permanently delete a flashcard",
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

	postParams(
		"bulk_delete_cards",
		"Delete multiple flashcards at once by their IDs",
		C,
		"/cards/bulk-delete",
		{
			card_ids: {
				type: "json",
				description: "JSON array of card UUIDs to delete",
				required: true,
			},
		},
	),

	postParams(
		"remove_cards_from_note",
		"Delete ALL flashcards linked to a specific note",
		C,
		"/cards/remove-from-note",
		{
			source_uid: {
				type: "string",
				description:
					"Source note UID (flashcard_uid from note frontmatter, e.g. 'b5a5a6d6'). If omitted, uses path or active note.",
			},
			path: {
				type: "string",
				description: "Vault path to the note. If omitted, uses active note.",
			},
		},
	),

	postParams(
		"bulk_suspend_cards",
		"Suspend or unsuspend multiple cards at once",
		C,
		"/cards/bulk-suspend",
		{
			card_ids: {
				type: "json",
				description: "JSON array of card UUIDs",
				required: true,
			},
			suspended: {
				type: "boolean",
				description: "true to suspend, false to unsuspend",
				required: true,
			},
		},
	),

	postParams(
		"bury_cards",
		"Temporarily hide cards until a date or for N days, or lift the bury with --unbury",
		C,
		"/cards/bulk-bury",
		{
			card_ids: {
				type: "json",
				description: "JSON array of card UUIDs to bury",
				required: true,
			},
			days: {
				type: "number",
				description: "Number of days to bury (default 1)",
			},
			until: {
				type: "string",
				description: "Bury until this ISO date (e.g. '2026-04-01')",
			},
			unbury: {
				type: "boolean",
				description:
					"Lift the bury immediately, returning the cards to their normal schedule",
			},
		},
	),
];
