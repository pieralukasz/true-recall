/**
 * Resolve CSS variable to concrete color for Chart.js.
 * Chart.js needs hex/rgb strings, not CSS var() references.
 */
export declare function getThemeColor(cssVar: string): string;
/** Common chart color palette using CSS variables */
export declare const CHART_COLORS: {
    readonly green: () => string;
    readonly orange: () => string;
    readonly blue: () => string;
    readonly red: () => string;
    readonly yellow: () => string;
    readonly cyan: () => string;
    readonly purple: () => string;
    readonly muted: () => string;
    readonly faint: () => string;
    readonly normal: () => string;
    readonly bgPrimary: () => string;
    readonly bgSecondary: () => string;
    readonly border: () => string;
};
/** Apply alpha to a resolved color string */
export declare function withAlpha(color: string, alpha: number): string;
