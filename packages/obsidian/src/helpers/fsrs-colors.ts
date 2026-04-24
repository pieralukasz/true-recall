import { State } from "ts-fsrs";

// ── Types ────────────────────────────────────────────────────

export type FsrsColorName = "green" | "orange" | "blue" | "red";

export type HighlightColor = FsrsColorName | "default";

interface FsrsColorConfig {
	cssVar: string;
	name: FsrsColorName;
	textCls: string;
	bgCls: string;
	badgeCls: string;
	borderCls: string;
	chipCls: string;
}

// ── Canonical state → color mapping ──────────────────────────
// Single source of truth. Every UI layer derives from this record.
//
// Tailwind note: full class literals appear here so the scanner
// detects them — never construct class names via template literals.

export const FSRS_COLORS = {
	new: {
		cssVar: "--color-green",
		name: "green",
		textCls: "ep:text-obs-green",
		bgCls: "ep:bg-obs-green/10",
		badgeCls: "ep:bg-obs-green/15 ep:text-obs-green",
		borderCls: "ep:border-obs-green/30",
		chipCls:
			"ep:bg-obs-green/15 ep:text-obs-green ep:border ep:border-obs-green/30",
	},
	learning: {
		cssVar: "--color-orange",
		name: "orange",
		textCls: "ep:text-obs-orange",
		bgCls: "ep:bg-obs-orange/10",
		badgeCls: "ep:bg-obs-orange/15 ep:text-obs-orange",
		borderCls: "ep:border-obs-orange/30",
		chipCls:
			"ep:bg-obs-orange/15 ep:text-obs-orange ep:border ep:border-obs-orange/30",
	},
	relearning: {
		cssVar: "--color-orange",
		name: "orange",
		textCls: "ep:text-obs-orange",
		bgCls: "ep:bg-obs-orange/10",
		badgeCls: "ep:bg-obs-orange/15 ep:text-obs-orange",
		borderCls: "ep:border-obs-orange/30",
		chipCls:
			"ep:bg-obs-orange/15 ep:text-obs-orange ep:border ep:border-obs-orange/30",
	},
	review: {
		cssVar: "--color-blue",
		name: "blue",
		textCls: "ep:text-obs-blue",
		bgCls: "ep:bg-obs-blue/10",
		badgeCls: "ep:bg-obs-blue/15 ep:text-obs-blue",
		borderCls: "ep:border-obs-blue/30",
		chipCls:
			"ep:bg-obs-blue/15 ep:text-obs-blue ep:border ep:border-obs-blue/30",
	},
	suspended: {
		cssVar: "--color-red",
		name: "red",
		textCls: "ep:text-obs-error",
		bgCls: "ep:bg-obs-red/10",
		badgeCls: "ep:bg-obs-red/15 ep:text-obs-error",
		borderCls: "ep:border-obs-red/30",
		chipCls:
			"ep:bg-obs-red/15 ep:text-obs-error ep:border ep:border-obs-red/30",
	},
} as const satisfies Record<string, FsrsColorConfig>;

// Non-FSRS visual states (muted, no color mapping)
export const MUTED_STATES = {
	buried: { badgeCls: "ep:bg-obs-modifier-hover ep:text-obs-muted" },
	unknown: { badgeCls: "ep:bg-obs-modifier-hover ep:text-obs-muted" },
} as const;

// ── Helpers ──────────────────────────────────────────────────

type FsrsStateKey = keyof typeof FSRS_COLORS;

const STATE_TO_KEY: Partial<Record<State, FsrsStateKey>> = {
	[State.New]: "new",
	[State.Learning]: "learning",
	[State.Relearning]: "relearning",
	[State.Review]: "review",
};

export function fsrsStateToColorName(state: State): FsrsColorName | null {
	const key = STATE_TO_KEY[state];
	return key ? FSRS_COLORS[key].name : null;
}
