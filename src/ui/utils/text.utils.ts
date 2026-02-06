/**
 * Text Utilities
 * Common text formatting functions for UI components
 */
import { BR_REGEX } from "../../utils";

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + "...";
}

/**
 * Strip HTML tags from a string
 * Converts <br> to spaces and removes all other tags
 */
export function stripHtml(html: string): string {
	return html
		.replace(BR_REGEX, " ")
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

