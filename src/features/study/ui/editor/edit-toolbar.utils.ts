/**
 * Edit Toolbar Utilities
 * Pure functions for text formatting operations on textareas,
 * toolbar button definitions, and related types.
 */

// ─── Toolbar Button Types & Data ───────────────────────────────────

export type ToolbarButtonAction =
	| { type: "toggle"; before: string; after: string }
	| { type: "insert"; text: string }
	| { type: "custom"; handler: (textarea: HTMLTextAreaElement) => void };

export interface ToolbarButton {
	id: string;
	label: string;
	title: string;
	action: ToolbarButtonAction;
	shortcut?: string;
}

export const TOOLBAR_BUTTONS = {
	UNIFIED: [
		{
			id: "bold",
			label: "B",
			title: "Bold",
			shortcut: "Ctrl+B",
			action: { type: "toggle", before: "**", after: "**" },
		},
		{
			id: "italic",
			label: "I",
			title: "Italic",
			shortcut: "Ctrl+I",
			action: { type: "toggle", before: "*", after: "*" },
		},
		{
			id: "underline",
			label: "U",
			title: "Underline",
			shortcut: "Ctrl+U",
			action: { type: "toggle", before: "<u>", after: "</u>" },
		},
		{
			id: "wiki",
			label: "[[]]",
			title: "Wiki Link",
			shortcut: "Ctrl+K",
			action: { type: "toggle", before: "[[", after: "]]" },
		},
		{
			id: "math",
			label: "$",
			title: "Math",
			shortcut: "Ctrl+M",
			action: { type: "toggle", before: "$", after: "$" },
		},
		{
			id: "h1",
			label: "H1",
			title: "Heading 1",
			shortcut: "Ctrl+1",
			action: { type: "insert", text: "# " },
		},
		{
			id: "h2",
			label: "H2",
			title: "Heading 2",
			shortcut: "Ctrl+2",
			action: { type: "insert", text: "## " },
		},
		{
			id: "list",
			label: "-",
			title: "List",
			shortcut: "Ctrl+L",
			action: { type: "insert", text: "- " },
		},
		{
			id: "quote",
			label: ">",
			title: "Quote",
			shortcut: "Ctrl+.",
			action: { type: "insert", text: "> " },
		},
		{
			id: "code",
			label: "`",
			title: "Code",
			shortcut: "Ctrl+`",
			action: { type: "toggle", before: "`", after: "`" },
		},
		{
			id: "codeblock",
			label: "```",
			title: "Code Block",
			shortcut: "Ctrl+Shift+C",
			action: { type: "toggle", before: "```\n", after: "\n```" },
		},
		{
			id: "superscript",
			label: "x\u00B2",
			title: "Superscript",
			action: { type: "toggle", before: "<sup>", after: "</sup>" },
		},
		{
			id: "subscript",
			label: "x\u2082",
			title: "Subscript",
			action: { type: "toggle", before: "<sub>", after: "</sub>" },
		},
	] as ToolbarButton[],
};

// ─── Textarea Utilities ────────────────────────────────────────────

/**
 * Toggle wrap selected text with before/after strings
 * If selection is already wrapped, unwrap it; otherwise wrap it
 */
export function toggleTextareaWrap(
	textarea: HTMLTextAreaElement,
	before: string,
	after: string,
): void {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selectedText = textarea.value.substring(start, end);

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
	text: string,
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
	textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * Setup auto-resize listener on textarea
 */
export function setupAutoResize(textarea: HTMLTextAreaElement): () => void {
	const handler = () => autoResizeTextarea(textarea);
	textarea.addEventListener("input", handler);
	// Initial resize
	autoResizeTextarea(textarea);
	return () => textarea.removeEventListener("input", handler);
}
