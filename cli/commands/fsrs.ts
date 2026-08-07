import type { CommandDef } from "../registry.js";
import { get, getWith, postParams, postTo } from "../registry.js";

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

	postTo(
		"update_fsrs_preset",
		"Update an FSRS preset: retention target, daily limits, learning steps, leech handling",
		C,
		{
			preset: {
				type: "string",
				description: "Preset id or name (e.g. Default)",
				required: true,
			},
			request_retention: {
				type: "number",
				description: "Target retention rate 0.7-0.99",
			},
			new_cards_per_day: {
				type: "number",
				description: "Daily new cards limit (0 = pause new cards)",
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
			leech_threshold: {
				type: "number",
				description: "Lapses before a card is tagged as leech",
			},
			leech_action: {
				type: "string",
				description: "What to do with leeches",
				enum: ["tag-only", "suspend"],
			},
			weights: {
				type: "json",
				description:
					"FSRS weights as JSON array of 21 numbers, or null to reset to defaults",
			},
		},
		(p) => `/presets/${encodeURIComponent(String(p.preset))}`,
		(p) => {
			const { preset: _preset, ...body } = p;
			return body;
		},
	),

	postParams(
		"set_load_balance",
		"Update load balancing settings: enabled, target_mode (auto = forecast average), manual target, deviation, shift range",
		C,
		"/settings/load-balance",
		{
			enabled: {
				type: "boolean",
				description: "Enable/disable load balancing when scheduling reviews",
			},
			target_mode: {
				type: "string",
				description:
					"How the daily target is set: auto (forecast average) or manual",
				enum: ["auto", "manual"],
			},
			target: {
				type: "number",
				description: "Manual target reviews/day (used in manual mode)",
			},
			max_deviation: {
				type: "number",
				description: "Allowed deviation from target in percent (0-100)",
			},
			max_shift_days: {
				type: "number",
				description: "Max day shift when balancing a newly scheduled review",
			},
			bulk_days: {
				type: "number",
				description: "Day range for Balance now (0 = all future)",
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
