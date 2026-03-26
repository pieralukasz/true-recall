import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerStatsTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.tool(
		"get_study_summary",
		"Get a comprehensive study summary: total cards, due count, today's stats (reviews, time, ratings), card maturity breakdown (new/learning/young/mature/suspended), and answer streaks.",
		{},
		async () => {
			const data = await client.get("/stats/summary");
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.tool(
		"get_daily_stats",
		"Get daily statistics for a date range. Returns reviews completed, new cards studied, time spent, and rating breakdown for each day.",
		{
			start_date: z
				.string()
				.describe("Start date in YYYY-MM-DD format"),
			end_date: z
				.string()
				.describe("End date in YYYY-MM-DD format"),
		},
		async (params) => {
			const data = await client.get(
				`/stats/daily?start=${params.start_date}&end=${params.end_date}`,
			);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.tool(
		"get_study_patterns",
		"Analyze study patterns over the last 30 days: best days of week, best hours, and a day/hour heatmap of review activity and success rates.",
		{},
		async () => {
			const data = await client.get("/stats/patterns");
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.tool(
		"get_problem_cards",
		"Identify leech cards — cards with high lapses (>3), low stability (<2 days), or in relearning state. These are cards the user struggles to remember.",
		{
			limit: z
				.number()
				.optional()
				.default(20)
				.describe("Max number of problem cards to return"),
		},
		async (params) => {
			const data = await client.get(
				`/cards/problems?limit=${params.limit}`,
			);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.tool(
		"get_study_recommendations",
		"Get AI-powered study recommendations based on current data. Analyzes overdue backlog, problem cards, study patterns, maturity distribution, and suggests what to focus on.",
		{
			focus: z
				.enum(["retention", "efficiency", "problem_cards", "general"])
				.optional()
				.default("general")
				.describe("What aspect to focus recommendations on"),
		},
		async (params) => {
			const results = await Promise.allSettled([
				client.get<Record<string, unknown>>("/stats/summary"),
				client.get<Record<string, unknown>>("/stats/patterns"),
				client.get<Record<string, unknown>>("/cards/problems?limit=10"),
			]);

			const unwrap = (r: PromiseSettledResult<Record<string, unknown>>) =>
				r.status === "fulfilled" ? r.value : { error: r.reason?.message ?? "Failed to fetch" };

			const analysisContext = {
				focus: params.focus,
				summary: unwrap(results[0]!),
				patterns: unwrap(results[1]!),
				problems: unwrap(results[2]!),
				instructions:
					"Based on the study data above, provide actionable recommendations. " +
					"Consider: overdue cards, problem card patterns, optimal study times, " +
					"maturity balance, and recent performance trends. " +
					"Be specific and practical.",
			};

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(analysisContext, null, 2),
					},
				],
			};
		},
	);
}
