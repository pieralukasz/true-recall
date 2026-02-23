const HIGHLIGHT_PATTERN = /==([^=]+)==/g;

export function extractHighlights(content: string): string[] {
	const matches: string[] = [];
	let match;
	while ((match = HIGHLIGHT_PATTERN.exec(content)) !== null) {
		if (match[1]?.trim()) {
			matches.push(match[1].trim());
		}
	}
	return matches;
}
