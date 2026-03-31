import { z } from "zod";
import { custom, get, getWith, jsonResult, type ToolDef } from "./_register.js";

export const statsTools: ToolDef[] = [
	get(
		"get_study_summary",
		"Get a comprehensive study summary: total cards, due count, today's stats (reviews, time, ratings), card maturity breakdown (new/learning/young/mature/suspended), and answer streaks.",
		"/stats/summary",
	),

	getWith(
		"get_daily_stats",
		"Get daily statistics for a date range. Returns reviews completed, new cards studied, time spent, and rating breakdown for each day.",
		{
			start_date: z.string().describe("Start date in YYYY-MM-DD format"),
			end_date: z.string().describe("End date in YYYY-MM-DD format"),
		},
		(p) => `/stats/daily?start=${p.start_date}&end=${p.end_date}`,
	),

	get(
		"get_study_patterns",
		"Analyze study patterns over the last 30 days: best days of week, best hours, and a day/hour heatmap of review activity and success rates.",
		"/stats/patterns",
	),

	getWith(
		"get_problem_cards",
		"Identify leech cards — cards with high lapses (>3), low stability (<2 days), or in relearning state. These are cards the user struggles to remember.",
		{
			limit: z
				.number()
				.optional()
				.default(20)
				.describe("Max number of problem cards to return"),
		},
		(p) => `/cards/problems?limit=${p.limit}`,
	),

	get(
		"get_session_analysis",
		"Analyze today's study session in detail: every card reviewed with its ratings, which notes were studied, cards the user struggled with (rated Again), retention rate, time spent, and per-note breakdown. Use this to discuss the user's study performance today.",
		"/stats/session-analysis",
	),

	custom(
		"get_study_recommendations",
		"Get AI-powered study recommendations based on current data. Analyzes overdue backlog, problem cards, study patterns, maturity distribution, and suggests what to focus on.",
		{
			focus: z
				.enum(["retention", "efficiency", "problem_cards", "general"])
				.optional()
				.default("general")
				.describe("What aspect to focus recommendations on"),
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
				instructions:
					"Based on the study data above, provide actionable recommendations. " +
					"Consider: overdue cards, problem card patterns, optimal study times, " +
					"maturity balance, and recent performance trends. " +
					"Be specific and practical.",
			});
		},
	),
];
