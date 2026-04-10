/**
 * Runtime theme color resolution for Chart.js and other APIs
 * that need raw CSS color strings instead of Tailwind classes.
 *
 * Uses Obsidian's CSS variables so colors adapt to light/dark/custom themes.
 */

export function getThemeColor(cssVar: string): string {
	return getComputedStyle(document.body).getPropertyValue(cssVar).trim();
}

function getThemeColorWithAlpha(cssVar: string, alpha: number): string {
	const rgb = getComputedStyle(document.body)
		.getPropertyValue(`${cssVar}-rgb`)
		.trim();
	return `rgba(${rgb}, ${alpha})`;
}
