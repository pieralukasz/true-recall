/**
 * Strip markdown/wiki syntax for plain-text display (e.g. table cells).
 * Mirrors @true-recall/core's string.utils.stripMarkdownSyntax.
 */
export function stripMarkdownSyntax(text: string): string {
	return (
		text
			// Code fences (``` ... ```)
			.replace(/```[\s\S]*?```/g, "")
			// HTML tags
			.replace(/<[^>]+>/g, "")
			// Images: wiki ![[img]] and md ![alt](url)
			.replace(/!\[\[([^\]]*)\]\]/g, "")
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
			// Wiki links: [[target|alias]] -> alias, [[target]] -> target
			.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
			.replace(/\[\[([^\]]*)\]\]/g, "$1")
			// Markdown links: [text](url) -> text
			.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
			// Cloze deletions: {{c1::text::hint}} -> text
			.replace(/\{\{c\d+::([^:}]*?)(?:::[^}]*)?\}\}/g, "$1")
			// Highlight ==text==
			.replace(/==([^=]+)==/g, "$1")
			// Bold + italic ***text*** / ___text___
			.replace(/\*{3}(.+?)\*{3}/g, "$1")
			.replace(/_{3}(.+?)_{3}/g, "$1")
			// Bold **text** / __text__
			.replace(/\*{2}(.+?)\*{2}/g, "$1")
			.replace(/_{2}(.+?)_{2}/g, "$1")
			// Italic *text* / _text_
			.replace(/\*(.+?)\*/g, "$1")
			.replace(/_(.+?)_/g, "$1")
			// Strikethrough ~~text~~
			.replace(/~~(.+?)~~/g, "$1")
			// Inline code `text`
			.replace(/`([^`]+)`/g, "$1")
			// Headings (# ... ######)
			.replace(/^#{1,6}\s+/gm, "")
			// Blockquotes
			.replace(/^>\s?/gm, "")
			// Unordered list markers
			.replace(/^[\t ]*[-*+]\s+/gm, "")
			// Ordered list markers
			.replace(/^[\t ]*\d+\.\s+/gm, "")
			// Horizontal rules
			.replace(/^[-*_]{3,}\s*$/gm, "")
			// LaTeX delimiters: $$ ... $$ and $ ... $
			.replace(/\$\$([^$]+)\$\$/g, "$1")
			.replace(/\$([^$\n]+)\$/g, "$1")
			// Collapse whitespace
			.replace(/\n+/g, " ")
			.replace(/\s{2,}/g, " ")
			.trim()
	);
}
