import type { CommandDef } from "../registry.js";
import { custom, get, getWith } from "../registry.js";

const C = "Statistics";

export const statsCommands: CommandDef[] = [
	get(
		"get_study_summary",
		"Comprehensive study summary: total cards, due count, today's stats, maturity breakdown, streaks",
		C,
		"/stats/summary",
	),

	getWith(
		"get_daily_stats",
		"Daily statistics for a date range: reviews, new cards, time spent, rating breakdown per day",
		C,
		{
			start_date: {
				type: "string",
				description: "Start date in YYYY-MM-DD format",
				required: true,
			},
			end_date: {
				type: "string",
				description: "End date in YYYY-MM-DD format",
				required: true,
			},
		},
		(p) => `/stats/daily?start=${p.start_date}&end=${p.end_date}`,
	),

	get(
		"get_study_patterns",
		"Analyze study patterns: best days/hours heatmap from last 30 days",
		C,
		"/stats/patterns",
	),

	get(
		"get_session_analysis",
		"Deep dive into today's session: every reviewed card with ratings, struggled cards, retention rate",
		C,
		"/stats/session-analysis",
	),

	custom(
		"get_study_recommendations",
		"AI-powered study recommendations based on summary, patterns, and problem cards",
		C,
		{
			focus: {
				type: "string",
				description: "What aspect to focus on",
				enum: ["retention", "efficiency", "problem_cards", "general"],
				default: "general",
			},
		},
		async (params, client) => {
			const [summary, patterns, problems] = await Promise.allSettled([
				client.get<Record<string, unknown>>("/stats/summary"),
				client.get<Record<string, unknown>>("/stats/patterns"),
				client.get<Record<string, unknown>>("/cards/problems?limit=10"),
			]);

			const unwrap = (r: PromiseSettledResult<Record<string, unknown>>) =>
				r.status === "fulfilled"
					? r.value
					: { error: (r.reason as Error)?.message ?? "Failed to fetch" };

			return {
				focus: params.focus,
				summary: unwrap(summary),
				patterns: unwrap(patterns),
				problems: unwrap(problems),
				instructions:
					"Based on the study data above, provide actionable recommendations. " +
					"Consider: overdue cards, problem card patterns, optimal study times, " +
					"maturity balance, and recent performance trends. " +
					"Be specific and practical.",
			};
		},
	),
];
