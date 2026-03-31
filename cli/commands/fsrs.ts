import type { CommandDef } from "../registry.js";
import { get, getWith, postParams } from "../registry.js";

const C = "FSRS";

export const fsrsCommands: CommandDef[] = [
	get(
		"get_fsrs_presets",
		"List all FSRS scheduling presets with retention target, daily limits, learning steps",
		C,
		"/presets",
	),

	postParams(
		"create_fsrs_preset",
		"Create a new FSRS scheduling preset with custom retention target and daily limits",
		C,
		"/presets",
		{
			name: {
				type: "string",
				description: "Preset name (must be unique)",
				required: true,
			},
			request_retention: {
				type: "number",
				description: "Target retention rate 0.7-0.99 (default 0.9 = 90%)",
			},
			new_cards_per_day: {
				type: "number",
				description: "Daily new cards limit",
			},
			reviews_per_day: {
				type: "number",
				description: "Daily reviews limit",
			},
			learning_steps: {
				type: "json",
				description: "Learning steps in minutes as JSON array, e.g. [1, 10]",
			},
			relearning_steps: {
				type: "json",
				description: "Relearning steps in minutes as JSON array, e.g. [10]",
			},
		},
	),

	getWith(
		"get_fsrs_analytics",
		"FSRS analytics: true retention, workload forecast, distributions (interval/stability/difficulty)",
		C,
		{
			days: {
				type: "number",
				description: "Analysis period in days (default 30)",
				default: 30,
			},
		},
		(p) => `/fsrs/stats?days=${p.days}`,
	),
];
