/**
 * Edit Toolbar Utilities
 * Pure functions for text formatting operations on textareas
 */

/**
 * Toggle wrap selected text with before/after strings
 * If selection is already wrapped, unwrap it; otherwise wrap it
 */
export function toggleTextareaWrap(
	textarea: HTMLTextAreaElement,
	before: string,
	after: string
): void {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selectedText = textarea.value.substring(start, end);

	// Check if selection is already wrapped
	if (selectedText.startsWith(before) && selectedText.endsWith(after)) {
		// Remove wrapping
		const unwrapped = selectedText.slice(before.length, -after.length);
		textarea.setRangeText(unwrapped, start, end, "select");
	} else {
		// Add wrapping
		const wrapped = before + selectedText + after;
		textarea.setRangeText(wrapped, start, end, "select");
	}

	// Trigger input event for auto-resize
	textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Insert text at cursor position
 */
export function insertAtTextareaCursor(
	textarea: HTMLTextAreaElement,
	text: string
): void {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;

	textarea.setRangeText(text, start, end, "end");
	textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Auto-resize textarea to fit content
 */
export function autoResizeTextarea(textarea: HTMLTextAreaElement): void {
	textarea.style.height = "auto";
	textarea.style.height = textarea.scrollHeight + "px";
}

/**
 * Setup auto-resize listener on textarea
 */
export function setupAutoResize(textarea: HTMLTextAreaElement): () => void {
	const handler = () => autoResizeTextarea(textarea);
	textarea.addEventListener("input", handler);
	// Initial resize
	autoResizeTextarea(textarea);
	// Return cleanup function
	return () => textarea.removeEventListener("input", handler);
}
