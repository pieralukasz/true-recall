import { z } from "zod";

import { editDateTimestamp } from "../../packages/core/src/helpers/edit-date.js";
import { UsageError } from "../cli-args.js";
import {
	custom,
	getWith,
	jsonResult,
	postParams,
	requireStringParam,
	type ToolDef,
} from "./_register.js";

const editDate = z
	.string()
	.refine(
		(value) => editDateTimestamp(value) !== undefined,
		"Expected a valid YYYY-MM-DD date (local midnight) or ISO datetime with explicit timezone",
	)
	.optional();

const editedCardsInput = {
	manual_only: z
		.boolean()
		.default(false)
		.describe(
			"Require lifetime editCount > 0; date bounds still use the last ANY (manual or AI) content edit, not the last manual edit",
		),
	ai_only: z
		.boolean()
		.default(false)
		.describe(
			"Require lifetime aiEditCount > 0; includes cards also edited manually. Date bounds use the last ANY content edit, not the last AI edit. Combine with manual_only to require both counters",
		),
	source_uid: z.string().optional().describe("Filter by source note UID"),
	since: editDate.describe(
		"Inclusive last-content-edit bound: YYYY-MM-DD (local midnight) or ISO datetime with timezone",
	),
	until: editDate.describe(
		"Exclusive last-content-edit bound; must be later than since",
	),
	limit: z
		.number()
		.int()
		.min(1)
		.max(200)
		.default(50)
		.describe("Max cards to return (1-200)"),
	offset: z
		.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.default(0)
		.describe("Number of matches to skip for pagination"),
};

const historyInput = {
	since: editedCardsInput.since.describe(
		"Inclusive actual event timestamp bound: date (local midnight) or timezone ISO timestamp",
	),
	until: editedCardsInput.until.describe(
		"Exclusive actual event timestamp bound; must be later than since",
	),
	limit: editedCardsInput.limit,
	offset: editedCardsInput.offset,
	source_uid: editedCardsInput.source_uid,
	edit_source: z
		.enum(["manual", "ai", "system"])
		.optional()
		.describe("Actual source of each event, not lifetime counters"),
};

function historyTool(perCard: boolean): ToolDef {
	const input = perCard
		? {
				...historyInput,
				card_id: z
					.string()
					.min(1)
					.refine((value) => value.trim().length > 0, "Missing card ID")
					.describe("Card ID; sibling cards share the owning note history"),
			}
		: historyInput;
	return custom(
		perCard ? "get_card_edit_history" : "list_card_edits",
		perCard
			? "Read persistent local card edit history with actual before/after, source and timestamp. Siblings share note history. Includes current text separately; retention is 50 per note, 10,000 globally, 90 days. No history before installation. Does not require SQL query endpoint."
			: "List actual persistent local edit events with before/after fields, source and timestamp, newest first. Retention: 50 per note, 10,000 globally, 90 days; no preinstallation history. Does not require SQL query endpoint.",
		input,
		async (params, client) => {
			const parsed = z.object(input).parse(params);
			const since =
				parsed.since === undefined
					? undefined
					: editDateTimestamp(parsed.since);
			const until =
				parsed.until === undefined
					? undefined
					: editDateTimestamp(parsed.until);
			if (since !== undefined && until !== undefined && until <= since)
				throw new UsageError("until must be later than since");
			const sp = new URLSearchParams();
			for (const [key, value] of Object.entries(parsed))
				if (
					key !== "card_id" &&
					(typeof value === "string" || typeof value === "number")
				)
					sp.set(key, String(value));
			const path = perCard
				? `/cards/${encodeURIComponent(requireStringParam(parsed, "card_id"))}/edit-history`
				: "/card-edits";
			return jsonResult(await client.get(`${path}?${sp}`));
		},
	);
}

export const cardTools: ToolDef[] = [
	historyTool(false),
	historyTool(true),
	custom(
		"list_edited_cards",
		"List edited flashcards with current rendered question and answer, newest content edit first (then card ID). Includes suspended cards and archived source notes; deleted cards and notes are excluded. Requires Enable SQL query endpoint. Counters are lifetime, note-level totals shared by sibling cards; contentEditedAt is the shared last manual OR AI content edit timestamp, not edit history.",
		editedCardsInput,
		async (params, client) => {
			const { limit, offset, since, until, manual_only, ai_only, source_uid } =
				z.object(editedCardsInput).parse(params);
			const sinceMs =
				since === undefined ? undefined : editDateTimestamp(since);
			const untilMs =
				until === undefined ? undefined : editDateTimestamp(until);
			if (
				sinceMs !== undefined &&
				untilMs !== undefined &&
				untilMs <= sinceMs
			) {
				throw new UsageError("until must be later than since");
			}
			const filters = [
				"c.deleted_at IS NULL",
				"n.deleted_at IS NULL",
				"n.content_edited_at IS NOT NULL",
			];
			if (sinceMs !== undefined)
				filters.push(`n.content_edited_at >= ${sinceMs}`);
			if (untilMs !== undefined)
				filters.push(`n.content_edited_at < ${untilMs}`);
			if (manual_only) filters.push("n.edit_count > 0");
			if (ai_only) filters.push("n.ai_edit_count > 0");
			if (source_uid !== undefined) {
				// A UTF-8 hex literal also avoids the endpoint's semicolon guard on text UIDs.
				filters.push(
					`n.source_uid = CAST(X'${Buffer.from(source_uid, "utf8").toString("hex")}' AS TEXT)`,
				);
			}
			const where = filters.join(" AND ");
			const from = "FROM cards c JOIN notes n ON n.id = c.note_id";
			const page = await client.post<{
				rows: Array<{ total: number; id: string | null }>;
			}>("/query", {
				sql: `SELECT totals.total, page.id FROM
					(SELECT COUNT(*) AS total ${from} WHERE ${where}) totals
					LEFT JOIN (SELECT c.id, n.content_edited_at ${from} WHERE ${where}
					ORDER BY n.content_edited_at DESC, c.id ASC LIMIT ${limit} OFFSET ${offset}) page ON 1 = 1
					ORDER BY page.content_edited_at DESC, page.id ASC`,
			});
			const total = page.rows[0].total;
			const cards = [];
			for (const row of page.rows) {
				if (row.id === null) continue;
				const card = await client.get<{
					id: string;
					question: string;
					answer: string;
					cardType: string;
					sourceUid?: string | null;
					editCount: number;
					aiEditCount: number;
					contentEditedAt: number | null;
				}>(`/cards/${encodeURIComponent(row.id)}`);
				cards.push({
					id: card.id,
					question: card.question,
					answer: card.answer,
					cardType: card.cardType,
					sourceUid: card.sourceUid ?? null,
					editCount: card.editCount,
					aiEditCount: card.aiEditCount,
					contentEditedAt: card.contentEditedAt,
					edited: true,
					manuallyEdited: card.editCount > 0,
					aiEdited: card.aiEditCount > 0,
				});
			}
			return jsonResult({
				total,
				count: cards.length,
				offset,
				hasMore: offset + cards.length < total,
				cards,
				limitation:
					"Counters are lifetime note-level totals shared by sibling cards. contentEditedAt is the shared last manual OR AI content edit, not a history, a manual-edit-in-window guarantee, or an AI-edit-in-window guarantee. Current card text is fetched after selection and may change during the request.",
			});
		},
	),
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
