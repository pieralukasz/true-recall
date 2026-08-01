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

	get(
		"get_easy_days",
		"Show easy-day configuration: recurring weekdays, specific dates, workload multiplier",
		C,
		"/settings/easy-days",
	),

	postParams(
		"set_easy_days",
		"Update easy days: recurring weekdays, specific dates, workload multiplier",
		C,
		"/settings/easy-days",
		{
			recurring_days: {
				type: "json",
				description:
					"JSON array of weekdays with reduced load, 0=Sunday .. 6=Saturday (e.g. '[0,6]')",
			},
			specific_dates: {
				type: "json",
				description:
					"JSON array of YYYY-MM-DD dates, replacing the current list (e.g. '[\"2026-08-05\"]')",
			},
			add_dates: {
				type: "json",
				description: "JSON array of YYYY-MM-DD dates to append to the list",
			},
			remove_dates: {
				type: "json",
				description: "JSON array of YYYY-MM-DD dates to drop from the list",
			},
			multiplier: {
				type: "number",
				description: "Workload multiplier for easy days, 0.0-1.0 (e.g. 0.5)",
			},
			apply: {
				type: "boolean",
				description: "Redistribute cards immediately after saving",
			},
		},
	),

	postParams(
		"add_easy_day",
		"Mark a single day as easy and redistribute right away. Defaults to today",
		C,
		"/settings/easy-days/add",
		{
			date: {
				type: "string",
				description: "Date in YYYY-MM-DD (defaults to today)",
			},
			apply: {
				type: "boolean",
				description:
					"Redistribute immediately (default true; pass false to only record the date)",
			},
		},
	),

	postParams(
		"apply_easy_days",
		"Redistribute reviews away from configured easy days",
		C,
		"/fsrs/easy-days/apply",
		{
			dry_run: {
				type: "boolean",
				description: "Preview only, without moving cards",
			},
			days: {
				type: "number",
				description: "How many days ahead to process (default 30)",
			},
		},
	),
];
