import { Rating, State } from "ts-fsrs";
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
        chipCls: "ep:bg-obs-green/15 ep:text-obs-green ep:border ep:border-obs-green/30",
    },
    learning: {
        cssVar: "--color-orange",
        name: "orange",
        textCls: "ep:text-obs-orange",
        bgCls: "ep:bg-obs-orange/10",
        badgeCls: "ep:bg-obs-orange/15 ep:text-obs-orange",
        borderCls: "ep:border-obs-orange/30",
        chipCls: "ep:bg-obs-orange/15 ep:text-obs-orange ep:border ep:border-obs-orange/30",
    },
    relearning: {
        cssVar: "--color-orange",
        name: "orange",
        textCls: "ep:text-obs-orange",
        bgCls: "ep:bg-obs-orange/10",
        badgeCls: "ep:bg-obs-orange/15 ep:text-obs-orange",
        borderCls: "ep:border-obs-orange/30",
        chipCls: "ep:bg-obs-orange/15 ep:text-obs-orange ep:border ep:border-obs-orange/30",
    },
    review: {
        cssVar: "--color-blue",
        name: "blue",
        textCls: "ep:text-obs-blue",
        bgCls: "ep:bg-obs-blue/10",
        badgeCls: "ep:bg-obs-blue/15 ep:text-obs-blue",
        borderCls: "ep:border-obs-blue/30",
        chipCls: "ep:bg-obs-blue/15 ep:text-obs-blue ep:border ep:border-obs-blue/30",
    },
    suspended: {
        cssVar: "--color-red",
        name: "red",
        textCls: "ep:text-obs-error",
        bgCls: "ep:bg-obs-red/10",
        badgeCls: "ep:bg-obs-red/15 ep:text-obs-error",
        borderCls: "ep:border-obs-red/30",
        chipCls: "ep:bg-obs-red/15 ep:text-obs-error ep:border ep:border-obs-red/30",
    },
};
// Non-FSRS visual states (muted, no color mapping)
export const MUTED_STATES = {
    buried: { badgeCls: "ep:bg-obs-modifier-hover ep:text-obs-muted" },
    unknown: { badgeCls: "ep:bg-obs-modifier-hover ep:text-obs-muted" },
};
// ── Helpers ──────────────────────────────────────────────────
const STATE_TO_KEY = {
    [State.New]: "new",
    [State.Learning]: "learning",
    [State.Relearning]: "relearning",
    [State.Review]: "review",
};
export function fsrsStateToColor(state) {
    const key = STATE_TO_KEY[state];
    return key ? FSRS_COLORS[key] : null;
}
export function fsrsStateToCssVar(state) {
    const config = fsrsStateToColor(state);
    return config ? `var(${config.cssVar})` : "var(--text-muted)";
}
export function fsrsStateToColorName(state) {
    var _a, _b;
    return (_b = (_a = fsrsStateToColor(state)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : null;
}
export const RATING_COLORS = {
    [Rating.Manual]: {
        borderCls: "ep:border-obs-border/30",
        hoverBgCls: "ep:hover:bg-obs-modifier-hover",
    },
    [Rating.Again]: {
        borderCls: "ep:border-obs-red/30",
        hoverBgCls: "ep:hover:bg-obs-red/10",
    },
    [Rating.Hard]: {
        borderCls: "ep:border-obs-orange/30",
        hoverBgCls: "ep:hover:bg-obs-orange/10",
    },
    [Rating.Good]: {
        borderCls: "ep:border-obs-green/30",
        hoverBgCls: "ep:hover:bg-obs-green/10",
    },
    [Rating.Easy]: {
        borderCls: "ep:border-obs-cyan/30",
        hoverBgCls: "ep:hover:bg-obs-cyan/10",
    },
};
