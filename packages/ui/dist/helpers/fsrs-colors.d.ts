import { Rating, State } from "ts-fsrs";
export type FsrsColorName = "green" | "orange" | "blue" | "red";
export type HighlightColor = FsrsColorName | "default";
export interface FsrsColorConfig {
    cssVar: string;
    name: FsrsColorName;
    textCls: string;
    bgCls: string;
    badgeCls: string;
    borderCls: string;
    chipCls: string;
}
export declare const FSRS_COLORS: {
    readonly new: {
        readonly cssVar: "--color-green";
        readonly name: "green";
        readonly textCls: "ep:text-obs-green";
        readonly bgCls: "ep:bg-obs-green/10";
        readonly badgeCls: "ep:bg-obs-green/15 ep:text-obs-green";
        readonly borderCls: "ep:border-obs-green/30";
        readonly chipCls: "ep:bg-obs-green/15 ep:text-obs-green ep:border ep:border-obs-green/30";
    };
    readonly learning: {
        readonly cssVar: "--color-orange";
        readonly name: "orange";
        readonly textCls: "ep:text-obs-orange";
        readonly bgCls: "ep:bg-obs-orange/10";
        readonly badgeCls: "ep:bg-obs-orange/15 ep:text-obs-orange";
        readonly borderCls: "ep:border-obs-orange/30";
        readonly chipCls: "ep:bg-obs-orange/15 ep:text-obs-orange ep:border ep:border-obs-orange/30";
    };
    readonly relearning: {
        readonly cssVar: "--color-orange";
        readonly name: "orange";
        readonly textCls: "ep:text-obs-orange";
        readonly bgCls: "ep:bg-obs-orange/10";
        readonly badgeCls: "ep:bg-obs-orange/15 ep:text-obs-orange";
        readonly borderCls: "ep:border-obs-orange/30";
        readonly chipCls: "ep:bg-obs-orange/15 ep:text-obs-orange ep:border ep:border-obs-orange/30";
    };
    readonly review: {
        readonly cssVar: "--color-blue";
        readonly name: "blue";
        readonly textCls: "ep:text-obs-blue";
        readonly bgCls: "ep:bg-obs-blue/10";
        readonly badgeCls: "ep:bg-obs-blue/15 ep:text-obs-blue";
        readonly borderCls: "ep:border-obs-blue/30";
        readonly chipCls: "ep:bg-obs-blue/15 ep:text-obs-blue ep:border ep:border-obs-blue/30";
    };
    readonly suspended: {
        readonly cssVar: "--color-red";
        readonly name: "red";
        readonly textCls: "ep:text-obs-error";
        readonly bgCls: "ep:bg-obs-red/10";
        readonly badgeCls: "ep:bg-obs-red/15 ep:text-obs-error";
        readonly borderCls: "ep:border-obs-red/30";
        readonly chipCls: "ep:bg-obs-red/15 ep:text-obs-error ep:border ep:border-obs-red/30";
    };
};
export type FsrsStateKey = keyof typeof FSRS_COLORS;
export declare const MUTED_STATES: {
    readonly buried: {
        readonly badgeCls: "ep:bg-obs-modifier-hover ep:text-obs-muted";
    };
    readonly unknown: {
        readonly badgeCls: "ep:bg-obs-modifier-hover ep:text-obs-muted";
    };
};
export declare function fsrsStateToColor(state: State): FsrsColorConfig | null;
export declare function fsrsStateToCssVar(state: State): string;
export declare function fsrsStateToColorName(state: State): FsrsColorName | null;
export interface RatingColorConfig {
    borderCls: string;
    hoverBgCls: string;
}
export declare const RATING_COLORS: Record<Rating, RatingColorConfig>;
