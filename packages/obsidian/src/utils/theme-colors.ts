/**
 * Runtime theme color resolution for Chart.js and other APIs
 * that need raw CSS color strings instead of Tailwind classes.
 *
 * Uses Obsidian's CSS variables so colors adapt to light/dark/custom themes.
 */

export function getThemeColor(cssVar: string): string {
	return getComputedStyle(activeDocument.body).getPropertyValue(cssVar).trim();
}
