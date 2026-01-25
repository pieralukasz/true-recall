/**
 * FSRS Simulator Constants
 */
import type { SliderConfig } from "./types";
import { DEFAULT_FSRS_WEIGHTS } from "../../constants";

/** Default review sequences */
export const DEFAULT_SEQUENCES = [
	"3333",
	"3332",
	"3331",
	"2333",
	"1333",
	"4331",
];

/** Color palette for sequences */
export const SEQUENCE_COLORS = [
	"#3b82f6", // blue
	"#ef4444", // red
	"#f59e0b", // amber
	"#22c55e", // green
	"#06b6d4", // cyan
	"#8b5cf6", // violet
	"#ec4899", // pink
	"#14b8a6", // teal
];

/** Grade names for display */
export const GRADE_NAMES: Record<number, string> = {
	0: "Initial",
	1: "Again",
	2: "Hard",
	3: "Good",
	4: "Easy",
};

/** Desired retention slider config */
export const RETENTION_SLIDER: SliderConfig = {
	index: -1,
	name: "desired retention",
	description: "Target probability of recall at review time",
	min: 0.8,
	max: 0.99,
	step: 0.01,
	defaultValue: 0.9,
};

/** FSRS v6 parameter slider configurations */
export const FSRS_WEIGHT_SLIDERS: SliderConfig[] = [
	{
		index: 0,
		name: "0. initial stability (Again)",
		description: "Initial stability when first rating is Again",
		min: 0.001,
		max: 100,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[0],
	},
	{
		index: 1,
		name: "1. initial stability (Hard)",
		description: "Initial stability when first rating is Hard",
		min: 0.001,
		max: 100,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[1],
	},
	{
		index: 2,
		name: "2. initial stability (Good)",
		description: "Initial stability when first rating is Good",
		min: 0.001,
		max: 100,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[2],
	},
	{
		index: 3,
		name: "3. initial stability (Easy)",
		description: "Initial stability when first rating is Easy",
		min: 0.001,
		max: 100,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[3],
	},
	{
		index: 4,
		name: "4. initial difficulty (Good)",
		description: "Initial difficulty when first rating is Good",
		min: 1,
		max: 10,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[4],
	},
	{
		index: 5,
		name: "5. initial difficulty (multiplier)",
		description: "Difficulty adjustment multiplier",
		min: 0.001,
		max: 4,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[5],
	},
	{
		index: 6,
		name: "6. difficulty (multiplier)",
		description: "Difficulty change multiplier",
		min: 0.001,
		max: 4,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[6],
	},
	{
		index: 7,
		name: "7. difficulty (multiplier)",
		description: "Hard penalty factor",
		min: 0.001,
		max: 0.75,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[7],
	},
	{
		index: 8,
		name: "8. stability (exponent)",
		description: "Stability calculation exponent",
		min: 0,
		max: 4.5,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[8],
	},
	{
		index: 9,
		name: "9. stability (negative power)",
		description: "Stability negative power factor",
		min: 0,
		max: 0.8,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[9],
	},
	{
		index: 10,
		name: "10. stability (exponent)",
		description: "Recall stability exponent",
		min: 0.001,
		max: 3.5,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[10],
	},
	{
		index: 11,
		name: "11. fail stability (multiplier)",
		description: "Lapse stability multiplier",
		min: 0.001,
		max: 5,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[11],
	},
	{
		index: 12,
		name: "12. fail stability (negative power)",
		description: "Lapse stability negative power",
		min: 0.001,
		max: 0.25,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[12],
	},
	{
		index: 13,
		name: "13. fail stability (power)",
		description: "Lapse stability power",
		min: 0.001,
		max: 0.9,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[13],
	},
	{
		index: 14,
		name: "14. fail stability (exponent)",
		description: "Lapse retrievability exponent",
		min: 0,
		max: 4,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[14],
	},
	{
		index: 15,
		name: "15. stability (multiplier for Hard)",
		description: "Hard rating stability multiplier",
		min: 0,
		max: 1,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[15],
	},
	{
		index: 16,
		name: "16. stability (multiplier for Easy)",
		description: "Easy rating stability multiplier",
		min: 1,
		max: 6,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[16],
	},
	{
		index: 17,
		name: "17. short-term stability (exponent)",
		description: "Short-term stability exponent",
		min: 0,
		max: 2,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[17],
	},
	{
		index: 18,
		name: "18. short-term stability (exponent)",
		description: "Short-term stability offset",
		min: 0,
		max: 2,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[18],
	},
	{
		index: 19,
		name: "19. short-term last-stability (exponent)",
		description: "Same-day stability exponent",
		min: 0,
		max: 0.8,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[19],
	},
	{
		index: 20,
		name: "20. decay",
		description: "Forgetting curve decay",
		min: 0.1,
		max: 0.8,
		step: 0.0001,
		defaultValue: DEFAULT_FSRS_WEIGHTS[20],
	},
];

/** All sliders (retention + 21 weights) */
export const ALL_SLIDERS: SliderConfig[] = [RETENTION_SLIDER, ...FSRS_WEIGHT_SLIDERS];
