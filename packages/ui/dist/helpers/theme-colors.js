/**
 * Runtime theme color resolution for Chart.js and other APIs
 * that need raw CSS color strings instead of Tailwind classes.
 *
 * Uses CSS variables so colors adapt to light/dark/custom themes.
 */
export function getThemeColor(cssVar) {
    return getComputedStyle(document.body).getPropertyValue(cssVar).trim();
}
export function getThemeColorWithAlpha(cssVar, alpha) {
    const rgb = getComputedStyle(document.body)
        .getPropertyValue(`${cssVar}-rgb`)
        .trim();
    return `rgba(${rgb}, ${alpha})`;
}
