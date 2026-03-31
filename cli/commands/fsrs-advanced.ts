import type { CommandDef } from "../registry.js";
import { getWith, postParams } from "../registry.js";

const C = "FSRS Advanced";

export const fsrsAdvancedCommands: CommandDef[] = [
	getWith(
		"optimize_parameters",
		"Optimize FSRS weights from review history. Needs 400+ reviews.",
		C,
		{
			preset_name: {
				type: "string",
				description: "Scope to a specific preset (default: all)",
			},
		},
		(p) =>
			`/fsrs/optimize${p.preset_name ? `?preset_name=${encodeURIComponent(String(p.preset_name))}` : ""}`,
	),

	postParams(
		"simulate_reviews",
		'Simulate FSRS scheduling for "what if" scenarios. Sequences are rating strings (e.g. "3333" = all Good).',
		C,
		"/fsrs/simulate",
		{
			sequences: {
				type: "json",
				description: 'JSON array of rating strings, e.g. \'["3333","3132"]\'',
				required: true,
			},
			retention: {
				type: "number",
				description: "Target retention (default: from settings)",
			},
			weights: {
				type: "json",
				description:
					"Custom FSRS weights as JSON array (default: from settings)",
			},
		},
	),

	getWith(
		"get_workload_forecast",
		"Detailed daily workload forecast: predicted reviews per day + day-of-week breakdown",
		C,
		{
			days: {
				type: "number",
				description: "Forecast period in days (default 30)",
				default: 30,
			},
		},
		(p) => `/fsrs/forecast?days=${p.days}`,
	),

	getWith(
		"get_retrievability",
		"Get current recall probability (0-1) for a card. 'You have 85% chance of remembering this.'",
		C,
		{
			card_id: {
				type: "string",
				description: "The card's UUID",
				required: true,
			},
		},
		(p) => `/cards/${p.card_id}/retrievability`,
	),

	getWith(
		"get_scheduling_preview",
		"Preview what happens at each rating: next interval for Again/Hard/Good/Easy",
		C,
		{
			card_id: {
				type: "string",
				description: "The card's UUID",
				required: true,
			},
		},
		(p) => `/cards/${p.card_id}/preview`,
	),
];
