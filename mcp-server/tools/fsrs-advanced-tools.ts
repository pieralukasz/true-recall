import { z } from "zod";

import {
	custom,
	getWith,
	jsonResult,
	postParams,
	requireStringParam,
	type ToolDef,
	withQuery,
} from "./_register.js";

/** Replay-based training over the full review history takes minutes. */
export const OPTIMIZE_TIMEOUT_MS = 600_000;

/** Replaying every card's history and a backup can exceed the default 30 s. */
export const RESCHEDULE_TIMEOUT_MS = 300_000;

const cardPath = (p: Record<string, unknown>, suffix: string) =>
	`/cards/${encodeURIComponent(requireStringParam(p, "card_id"))}/${suffix}`;

export const fsrsAdvancedTools: ToolDef[] = [
	custom(
		"optimize_parameters",
		"Train FSRS weights on the user's review history and return weights, metrics (rmse, logLoss, reviewCount, convergenceStatus) and improvement. It needs at least 400 reviews: with fewer, convergenceStatus is insufficient_data and the weights are not new. It can take several minutes. It only computes; to use the weights, pass them to update_fsrs_preset after the user agrees.",
		{
			preset_name: z
				.string()
				.optional()
				.describe(
					"Start from this preset's weights; an unknown name falls back to the default preset",
				),
		},
		async (p, client) =>
			jsonResult(
				await client.get(
					withQuery("/fsrs/optimize", { preset_name: p.preset_name }),
					OPTIMIZE_TIMEOUT_MS,
				),
			),
	),

	custom(
		"reschedule_from_history",
		"Recompute every Review card's FSRS memory state (stability, difficulty) from its full review history with the current preset weights and move due dates, so new weights (after optimize_parameters + update_fsrs_preset) take effect today instead of one review at a time. Cards without a full history keep their stored memory state and only get a new interval (summary.fromStoredState). Dry run by default: returns a summary (cards due today and average per day for the next 30 days, before and after, also excluding archived notes in summary.visible) and a sample. mode postpone-only (default) never moves a card earlier than it is scheduled; full applies the model's dates. With dry_run false it creates a database backup first, writes in one transaction, skips cards answered meanwhile (staleSkipped), and adds one undo step the user can revert with Ctrl+Z in Obsidian; review history is not changed. Confirm with the user before writing.",
		{
			mode: z
				.enum(["postpone-only", "full"])
				.optional()
				.describe(
					"postpone-only (default): never earlier than scheduled; full: use the model's due dates",
				),
			dry_run: z
				.boolean()
				.optional()
				.describe("Default true: only compute. false writes the changes."),
			sample: z
				.number()
				.int()
				.min(0)
				.max(50)
				.optional()
				.describe("How many changed cards to include as examples (default 5)"),
		},
		async (p, client) =>
			jsonResult(
				await client.post(
					"/fsrs/reschedule-from-history",
					p,
					RESCHEDULE_TIMEOUT_MS,
				),
			),
	),

	postParams(
		"simulate_reviews",
		"Simulate how FSRS would schedule a card for given rating sequences, e.g. '3333' (four Good answers) against '3132'. Returns the intervals and memory state after each rating. Changes nothing.",
		"/fsrs/simulate",
		{
			sequences: z
				.array(z.string().regex(/^[1-4]+$/))
				.min(1)
				.describe(
					"Rating sequences, one digit per review: 1=Again, 2=Hard, 3=Good, 4=Easy",
				),
			retention: z
				.number()
				.min(0.7)
				.max(0.99)
				.optional()
				.describe("Target retention (default: the default preset's)"),
			weights: z
				.array(z.number())
				.optional()
				.describe("FSRS weights (default: the default preset's)"),
		},
	),

	getWith(
		"get_workload_forecast",
		"Predict reviews per day for the next days days and by weekday, for the whole collection or one project. Fails with 404 when the project has no notes.",
		{
			days: z
				.number()
				.int()
				.min(1)
				.optional()
				.default(30)
				.describe("Days to forecast (default 30)"),
			project: z
				.string()
				.optional()
				.describe("Project note path from get_projects, to limit the forecast"),
		},
		(p) => withQuery("/fsrs/forecast", { days: p.days, project: p.project }),
	),

	getWith(
		"get_retrievability",
		"Get the probability (0-1 and as a percentage) that the user recalls a card right now, from its FSRS memory state.",
		{ card_id: z.string().describe("The card's UUID") },
		(p) => cardPath(p, "retrievability"),
	),

	getWith(
		"get_scheduling_preview",
		"Show a card's current FSRS state and what each rating (Again, Hard, Good, Easy) would do: next due date and interval. Changes nothing.",
		{ card_id: z.string().describe("The card's UUID") },
		(p) => cardPath(p, "preview"),
	),
];

export const exportTools: ToolDef[] = [
	custom(
		"export_csv",
		"Export flashcards as CSV or TSV text and return content and a suggested filename; it writes no file, so save content where the user wants it. All cards are exported unless source_uids narrows them.",
		{
			source_uids: z
				.array(z.string())
				.optional()
				.describe("Only cards from these notes (flashcard_uid values)"),
			include_scheduling: z
				.boolean()
				.optional()
				.default(true)
				.describe("Add FSRS scheduling columns (default true)"),
			separator: z
				.enum([",", ";", "tab"])
				.optional()
				.default(",")
				.describe("Column separator; tab gives TSV"),
		},
		async (p, client) =>
			jsonResult(await client.post("/export/csv", exportBody(p))),
	),
];

/** Body for /export/csv; "tab" becomes a real tab character. */
export function exportBody(
	p: Record<string, unknown>,
): Record<string, unknown> {
	return {
		source_uids: p.source_uids,
		include_scheduling: p.include_scheduling,
		separator: p.separator === "tab" ? "\t" : p.separator,
	};
}
