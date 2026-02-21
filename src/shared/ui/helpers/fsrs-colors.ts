import { State } from "ts-fsrs";

// ── Types ────────────────────────────────────────────────────

export type FsrsColorName = "green" | "orange" | "blue" | "red";

export type HighlightColor = FsrsColorName | "default";

export interface FsrsColorConfig {
	cssVar: string;
	name: FsrsColorName;
	textCls: string;
	bgCls: string;
	badgeCls: string;
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
	},
	learning: {
		cssVar: "--color-orange",
		name: "orange",
		textCls: "ep:text-obs-orange",
		bgCls: "ep:bg-obs-orange/10",
		badgeCls: "ep:bg-obs-orange/15 ep:text-obs-orange",
	},
	relearning: {
		cssVar: "--color-orange",
		name: "orange",
		textCls: "ep:text-obs-orange",
		bgCls: "ep:bg-obs-orange/10",
		badgeCls: "ep:bg-obs-orange/15 ep:text-obs-orange",
	},
	review: {
		cssVar: "--color-blue",
		name: "blue",
		textCls: "ep:text-obs-blue",
		bgCls: "ep:bg-obs-blue/10",
		badgeCls: "ep:bg-obs-blue/15 ep:text-obs-blue",
	},
	suspended: {
		cssVar: "--color-red",
		name: "red",
		textCls: "ep:text-obs-error",
		bgCls: "ep:bg-obs-red/10",
		badgeCls: "ep:bg-obs-red/15 ep:text-obs-error",
	},
} as const satisfies Record<string, FsrsColorConfig>;

export type FsrsStateKey = keyof typeof FSRS_COLORS;

// Non-FSRS visual states (muted, no color mapping)
export const MUTED_STATES = {
	buried: { badgeCls: "ep:bg-obs-modifier-hover ep:text-obs-muted" },
	unknown: { badgeCls: "ep:bg-obs-modifier-hover ep:text-obs-muted" },
} as const;

// ── Helpers ──────────────────────────────────────────────────

const STATE_TO_KEY: Partial<Record<State, FsrsStateKey>> = {
	[State.New]: "new",
	[State.Learning]: "learning",
	[State.Relearning]: "relearning",
	[State.Review]: "review",
};

export function fsrsStateToColor(state: State): FsrsColorConfig | null {
	const key = STATE_TO_KEY[state];
	return key ? FSRS_COLORS[key] : null;
}

export function fsrsStateToCssVar(state: State): string {
	const config = fsrsStateToColor(state);
	return config ? `var(${config.cssVar})` : "var(--text-muted)";
}

export function fsrsStateToColorName(state: State): FsrsColorName | null {
	return fsrsStateToColor(state)?.name ?? null;
}
