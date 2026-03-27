import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerFsrsTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"get_fsrs_presets",
		{
			description:
				"List all FSRS scheduling presets. Each preset defines retention target, daily limits, learning steps, and leech detection settings. Notes/projects can be assigned to specific presets.",
		},
		async () => {
			const data = await client.get("/presets");
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"create_fsrs_preset",
		{
			description:
				"Create a new FSRS scheduling preset with custom retention target and daily limits. Useful for different study goals (e.g. 'Exam Prep' with higher retention and more daily cards).",
			inputSchema: {
				name: z.string().describe("Preset name (must be unique)"),
				request_retention: z
					.number()
					.min(0.7)
					.max(0.99)
					.optional()
					.describe(
						"Target retention rate 0.7-0.99 (default 0.9 = 90%). Higher = more reviews but better recall.",
					),
				new_cards_per_day: z
					.number()
					.optional()
					.describe("Daily new cards limit (default: from default preset)"),
				reviews_per_day: z
					.number()
					.optional()
					.describe("Daily reviews limit (default: from default preset)"),
				learning_steps: z
					.array(z.number())
					.optional()
					.describe(
						"Learning steps in minutes, e.g. [1, 10]. Cards go through these intervals before graduating to Review.",
					),
				relearning_steps: z
					.array(z.number())
					.optional()
					.describe(
						"Relearning steps in minutes, e.g. [10]. Used when a Review card is rated Again.",
					),
			},
		},
		async (params) => {
			const data = await client.post("/presets", {
				name: params.name,
				request_retention: params.request_retention,
				new_cards_per_day: params.new_cards_per_day,
				reviews_per_day: params.reviews_per_day,
				learning_steps: params.learning_steps,
				relearning_steps: params.relearning_steps,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"get_fsrs_analytics",
		{
			description:
				"Get FSRS analytics: true retention (actual vs target), workload forecast (predicted reviews per day), workload by day of week, and card distributions (interval, stability, difficulty histograms).",
			inputSchema: {
				days: z
					.number()
					.optional()
					.default(30)
					.describe("Analysis period in days (default 30)"),
			},
		},
		async (params) => {
			const data = await client.get(
				`/fsrs/stats?days=${params.days}`,
			);
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);
}
