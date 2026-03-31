const HIGHLIGHT_PATTERN = /==([^=]+)==/g;

export function extractHighlights(content: string): string[] {
	return Array.from(content.matchAll(HIGHLIGHT_PATTERN))
		.map((match) => match[1]?.trim())
		.filter((s): s is string => s !== undefined && s.length > 0);
}
