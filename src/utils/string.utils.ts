/**
 * String manipulation utilities shared across the codebase
 */

/** Matches <br>, <br/>, <br /> tags (case-insensitive) */
export const BR_REGEX = /<br\s*\/?>/gi;

/**
 * Replace <br> tags with newlines for display/editing
 */
export function stripBrTags(text: string): string {
	return text.replace(BR_REGEX, "\n");
}

/**
 * Strip wiki link syntax from a string
 * "[[Note Name]]" -> "Note Name"
 */
export function stripWikiLinkSyntax(value: string): string {
	return value.replace(/^\[\[|\]\]$/g, "").trim();
}
