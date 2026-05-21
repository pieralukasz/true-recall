/**
 * Detect whether a markdown string contains block-level constructs that
 * should be rendered left-aligned rather than centered.
 *
 * Used by the review UI to toggle the `is-block-content` class on the
 * question/answer wrappers, replacing the previous `:has(pre, ul, ol, …)`
 * CSS selectors that the Obsidian plugin reviewer flagged for poor
 * selector-invalidation performance.
 */
const BLOCK_MARKDOWN_PATTERNS: readonly RegExp[] = [
	/```/, // fenced code block
	/^\s*[-*+]\s/m, // unordered list
	/^\s*\d+[.)]\s/m, // ordered list
	/^\s*>\s/m, // blockquote
	/\$\$/, // display math
	/^\s*\|.*\|\s*$/m, // markdown table row
	/^\s*#{1,6}\s/m, // ATX heading
];

export function hasBlockMarkdown(content: string): boolean {
	if (!content) return false;
	for (const pattern of BLOCK_MARKDOWN_PATTERNS) {
		if (pattern.test(content)) return true;
	}
	return false;
}
