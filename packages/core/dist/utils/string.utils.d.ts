/**
 * String manipulation utilities shared across the codebase
 */
/** Matches <br>, <br/>, <br /> tags (case-insensitive) */
export declare const BR_REGEX: RegExp;
/**
 * Replace <br> tags with newlines for display/editing
 */
export declare function stripBrTags(text: string): string;
/**
 * Strip wiki link syntax from a string
 * "[[Note Name]]" -> "Note Name"
 */
export declare function stripWikiLinkSyntax(value: string): string;
/**
 * Strip markdown/wiki syntax for plain-text display (e.g. table cells).
 * Ordered so that block-level constructs are removed before inline ones,
 * and greedy patterns (bold **) before narrow ones (italic *).
 */
/** Extract filename without extension from a path: "folder/My Note.md" → "My Note" */
export declare function fileBasename(path: string): string;
export declare function stripMarkdownSyntax(text: string): string;
