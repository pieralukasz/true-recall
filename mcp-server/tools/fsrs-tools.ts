import { z } from "zod";
import { get, getWith, postParams, postTo, type ToolDef } from "./_register.js";

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

	postTo(
		"update_fsrs_preset",
		"Update an existing FSRS preset: retention target, daily limits, learning steps, leech handling. Identify the preset by id or name.",
		{
			preset: z.string().describe("Preset id or name (e.g. Default)"),
			request_retention: z
				.number()
				.min(0.7)
				.max(0.99)
				.optional()
				.describe(
					"Target retention rate 0.7-0.99. Higher = more reviews but better recall.",
				),
			new_cards_per_day: z
				.number()
				.optional()
				.describe("Daily new cards limit (0 = pause new cards)"),
			reviews_per_day: z.number().optional().describe("Daily reviews limit"),
			learning_steps: z
				.array(z.number())
				.optional()
				.describe("Learning steps in minutes, e.g. [1, 10]"),
			relearning_steps: z
				.array(z.number())
				.optional()
				.describe("Relearning steps in minutes, e.g. [10]"),
			leech_threshold: z
				.number()
				.optional()
				.describe("Lapses before a card is tagged as leech"),
			leech_action: z
				.enum(["tag-only", "suspend"])
				.optional()
				.describe("What to do with leeches"),
			weights: z
				.array(z.number())
				.nullable()
				.optional()
				.describe(
					"FSRS weights as an array of 21 numbers, or null to reset to defaults",
				),
		},
		(p) => `/presets/${encodeURIComponent(String(p.preset))}`,
		(p) => {
			const { preset: _preset, ...body } = p;
			return body;
		},
	),

	postParams(
		"set_load_balance",
		"Update load balancing settings: enable/disable, target mode (auto = forecast average, manual = fixed number), deviation, and shift range.",
		"/settings/load-balance",
		{
			enabled: z
				.boolean()
				.optional()
				.describe("Enable/disable load balancing when scheduling reviews"),
			target_mode: z
				.enum(["auto", "manual"])
				.optional()
				.describe(
					"How the daily target is set: auto (forecast average) or manual",
				),
			target: z
				.number()
				.optional()
				.describe("Manual target reviews/day (used in manual mode)"),
			max_deviation: z
				.number()
				.optional()
				.describe("Allowed deviation from target in percent (0-100)"),
			max_shift_days: z
				.number()
				.optional()
				.describe("Max day shift when balancing a newly scheduled review"),
			bulk_days: z
				.number()
				.optional()
				.describe("Day range for Balance now (0 = all future)"),
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
		(p) => `/fsrs/stats?days=${String(p.days)}`,
	),
];
