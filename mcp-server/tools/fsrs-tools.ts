import { z } from "zod";
import { get, getWith, postParams, type ToolDef } from "./_register.js";

export const fsrsTools: ToolDef[] = [
	get(
		"get_fsrs_presets",
		"List all FSRS scheduling presets. Each preset defines retention target, daily limits, learning steps, and leech detection settings. Notes/projects can be assigned to specific presets.",
		"/presets",
	),

	postParams(
		"create_fsrs_preset",
		"Create a new FSRS scheduling preset with custom retention target and daily limits. Useful for different study goals (e.g. 'Exam Prep' with higher retention and more daily cards).",
		"/presets",
		{
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
	),

	getWith(
		"get_fsrs_analytics",
		"Get FSRS analytics: true retention (actual vs target), workload forecast (predicted reviews per day), workload by day of week, and card distributions (interval, stability, difficulty histograms).",
		{
			days: z
				.number()
				.optional()
				.default(30)
				.describe("Analysis period in days (default 30)"),
		},
		(p) => `/fsrs/stats?days=${p.days}`,
	),
];
