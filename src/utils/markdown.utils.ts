/**
 * Markdown Utilities
 * Shared markdown conversion functions used across UI components
 */

/**
 * Convert contenteditable HTML to markdown text
 *
 * Handles different browser representations of line breaks:
 * - Chrome/Safari: <div>text</div> or <br>
 * - Firefox: <br>
 * - Edge: <p>text</p>
 *
 * Used by:
 * - ReviewView (inline editing)
 * - CardReviewItem (inline editing)
 * - FlashcardReviewModal (edit mode)
 *
 * @param element - The contenteditable HTML element
 * @returns Markdown text with <br> for line breaks (flashcard format)
 */
export function convertEditableToMarkdown(element: HTMLElement): string {
	let html = element.innerHTML;

	// Replace <br> tags with newline
	html = html.replace(/<br\s*\/?>/gi, "\n");

	// Replace closing </div> and </p> with newline (opening tags create blocks)
	html = html.replace(/<\/div>/gi, "\n");
	html = html.replace(/<\/p>/gi, "\n");

	// Remove remaining HTML tags
	html = html.replace(/<[^>]*>/g, "");

	// Decode HTML entities
	const textarea = document.createElement("textarea");
	textarea.innerHTML = html;
	const text = textarea.value;

	// Trim trailing newlines but preserve internal ones
	const trimmed = text.replace(/\n+$/, "");

	// Convert newlines back to <br> for flashcard format
	return trimmed.replace(/\n/g, "<br>");
}

/**
 * Convert contenteditable HTML to plain markdown text (no <br> conversion)
 *
 * @param element - The contenteditable HTML element
 * @returns Plain markdown text with newlines preserved
 */
export function convertEditableToPlainMarkdown(element: HTMLElement): string {
	let html = element.innerHTML;

	// Replace <br> tags with newline
	html = html.replace(/<br\s*\/?>/gi, "\n");

	// Replace closing </div> and </p> with newline
	html = html.replace(/<\/div>/gi, "\n");
	html = html.replace(/<\/p>/gi, "\n");

	// Remove remaining HTML tags
	html = html.replace(/<[^>]*>/g, "");

	// Decode HTML entities
	const textarea = document.createElement("textarea");
	textarea.innerHTML = html;
	const text = textarea.value;

	// Trim trailing newlines but preserve internal ones
	return text.replace(/\n+$/, "");
}

/**
 * Convert <br> tags in markdown to actual newlines
 *
 * @param markdown - Markdown string with <br> tags
 * @returns Markdown with newlines instead of <br>
 */
export function brToNewlines(markdown: string): string {
	return markdown.replace(/<br\s*\/?>/gi, "\n");
}

/**
 * Convert newlines to <br> tags (for flashcard format)
 *
 * @param text - Text with newlines
 * @returns Text with <br> tags
 */
export function newlinesToBr(text: string): string {
	return text.replace(/\n/g, "<br>");
}

/**
 * Escape HTML entities in a string
 *
 * @param text - Raw text
 * @returns HTML-escaped text
 */
export function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Unescape HTML entities in a string
 *
 * @param html - HTML-escaped text
 * @returns Raw text
 */
export function unescapeHtml(html: string): string {
	const textarea = document.createElement("textarea");
	textarea.innerHTML = html;
	return textarea.value;
}

/**
 * Strip all HTML tags from a string
 *
 * @param html - HTML string
 * @returns Plain text without HTML tags
 */
export function stripHtmlTags(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

/**
 * Truncate text to a maximum length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default 100)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 100): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength - 3) + "...";
}
