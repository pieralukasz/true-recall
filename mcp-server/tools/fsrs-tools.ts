import { z } from "zod";

import { get, getWith, postParams, postTo, type ToolDef } from "./_register.js";

export const fsrsTools: ToolDef[] = [
	get(
		"get_fsrs_presets",
		"List the FSRS scheduling presets with their retention target, daily limits, learning steps, leech settings and weights. Notes are assigned to a preset with set_note_preset; the rest use the default preset.",
		"/presets",
	),

	postParams(
		"create_fsrs_preset",
		"Create an FSRS scheduling preset, for example 'Exam prep' with higher retention. Settings you leave out are copied from the default preset. Fails with 409 if the name is taken. Returns id and name; assign it to notes with set_note_preset.",
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
		"Change an FSRS preset's retention target, daily limits, learning steps, leech handling or weights; fields you leave out keep their value. It overwrites the old values and changes future scheduling for every note using the preset; this API cannot undo it, so confirm weight changes with the user. Returns the list of fields updated.",
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
				.describe(
					"What to do with leeches: tag-only adds the 'leech' note tag, suspend also suspends the card",
				),
			weights: z
				.array(z.number())
				.nullable()
				.optional()
				.describe(
					"FSRS weights as 21 non-negative numbers (e.g. from optimize_parameters), or null for the FSRS defaults",
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
		"Change load-balancing settings, which spread newly scheduled reviews to even out daily workload: on/off, target mode (auto = forecast average, manual = fixed number), allowed deviation and maximum shift. Fields you leave out keep their value. Returns the resulting settings.",
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
		"Get FSRS analytics for the last days days: true retention against the target, predicted reviews per day, workload by weekday, and histograms of interval, stability and difficulty.",
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
