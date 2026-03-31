/**
 * Runtime theme color resolution for Chart.js and other APIs
 * that need raw CSS color strings instead of Tailwind classes.
 *
 * Uses CSS variables so colors adapt to light/dark/custom themes.
 */
export declare function getThemeColor(cssVar: string): string;
export declare function getThemeColorWithAlpha(cssVar: string, alpha: number): string;
