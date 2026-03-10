/**
 * Resolve Obsidian CSS variable to concrete color for Chart.js.
 * Chart.js needs hex/rgb strings, not CSS var() references.
 */
export function getThemeColor(cssVar: string): string {
	const raw = cssVar.startsWith("--") ? cssVar : cssVar.replace("var(", "").replace(")", "");
	const value = getComputedStyle(document.documentElement).getPropertyValue(raw).trim();
	return value || "#888888";
}

/** Common chart color palette using Obsidian CSS variables */
export const CHART_COLORS = {
	green: () => getThemeColor("--color-green"),
	orange: () => getThemeColor("--color-orange"),
	blue: () => getThemeColor("--color-blue"),
	red: () => getThemeColor("--color-red"),
	yellow: () => getThemeColor("--color-yellow"),
	cyan: () => getThemeColor("--color-cyan"),
	purple: () => getThemeColor("--color-purple"),
	muted: () => getThemeColor("--text-muted"),
	faint: () => getThemeColor("--text-faint"),
	normal: () => getThemeColor("--text-normal"),
	bgPrimary: () => getThemeColor("--background-primary"),
	bgSecondary: () => getThemeColor("--background-secondary"),
	border: () => getThemeColor("--background-modifier-border"),
} as const;

/** Apply alpha to a resolved color string */
export function withAlpha(color: string, alpha: number): string {
	// Handle hex colors
	if (color.startsWith("#")) {
		const r = parseInt(color.slice(1, 3), 16);
		const g = parseInt(color.slice(3, 5), 16);
		const b = parseInt(color.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	// Handle rgb/rgba
	if (color.startsWith("rgb")) {
		const match = color.match(/[\d.]+/g);
		if (match && match.length >= 3) {
			return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`;
		}
	}
	return color;
}
