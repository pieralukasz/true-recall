import { z } from "zod";

import {
	custom,
	get,
	getWith,
	jsonResult,
	requireStringParam,
	type ToolDef,
} from "./_register.js";

export const statsTools: ToolDef[] = [
	get(
		"get_study_summary",
		"Get a study summary: total cards, due count, today's reviews, time and ratings, card maturity (new, learning, young, mature, suspended) and answer streaks.",
		"/stats/summary",
	),

	getWith(
		"get_daily_stats",
		"Get per-day study stats for a date range (at most 366 days): reviews, new cards, time spent and ratings for each day.",
		{
			start_date: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/)
				.describe("First day, YYYY-MM-DD"),
			end_date: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/)
				.describe("Last day, YYYY-MM-DD, not before start_date"),
		},
		(p) =>
			`/stats/daily?start=${requireStringParam(p, "start_date")}&end=${requireStringParam(p, "end_date")}`,
	),

	get(
		"get_study_patterns",
		"Get study patterns from the last 30 days: best weekdays and hours, and a weekday-by-hour heatmap of review counts and success rates.",
		"/stats/patterns",
	),

	getWith(
		"get_problem_cards",
		"Get cards the user struggles with: more than 3 lapses, stability under 2 days, or in Relearning. Suspended cards are left out. Sorted by lapses, then lowest stability; each card has a problem_type.",
		{
			limit: z
				.number()
				.int()
				.min(1)
				.optional()
				.default(50)
				.describe("Max cards to return (default 50)"),
		},
		(p) => `/cards/problems?limit=${String(p.limit)}`,
	),

	get(
		"get_session_analysis",
		"Get today's reviews in detail: every card reviewed with its ratings, the notes studied, cards rated Again, retention rate, time spent and a per-note breakdown. Returns hasData false when there were no reviews today.",
		"/stats/session-analysis",
	),

	custom(
		"get_study_recommendations",
		"Fetch in one call the study summary, the study patterns and the 10 worst problem cards, so you can recommend what the user should study next. It calls no AI model; the recommendations are yours to write. focus is echoed back as a reminder of what the user asked about and doesn't change the data. A part that fails comes back as { error } without failing the call.",
		{
			focus: z
				.enum(["retention", "efficiency", "problem_cards", "general"])
				.optional()
				.default("general")
				.describe("What the user wants advice on; echoed back unchanged"),
		},
		async (params, client) => {
			const results = await Promise.allSettled([
				client.get<Record<string, unknown>>("/stats/summary"),
				client.get<Record<string, unknown>>("/stats/patterns"),
				client.get<Record<string, unknown>>("/cards/problems?limit=10"),
			]);

			const unwrap = (r: PromiseSettledResult<Record<string, unknown>>) =>
				r.status === "fulfilled"
					? r.value
					: { error: (r.reason as Error)?.message ?? "Failed to fetch" };

			const [summary, patterns, problems] = results;
			return jsonResult({
				focus: params.focus,
				summary: unwrap(summary),
				patterns: unwrap(patterns),
				problems: unwrap(problems),
			});
		},
	),
];
