/**
 * Autocomplete Types
 * Type definitions for the autocomplete/autolinking feature
 */

/**
 * Represents a note suggestion for autocomplete
 */
export interface NoteSuggestion {
	/** Full note name (including .md extension if present) */
	noteName: string;
	/** Basename without extension (for display) */
	noteBasename: string;
	/** How the match was found: title or alias */
	matchType: "title" | "alias";
	/** The actual text that matched (useful for alias matches) */
	matchedText: string;
	/** Full file path in the vault */
	filePath: string;
}

/**
 * Represents the context around the cursor in a textarea
 */
export interface CursorContext {
	/** The word being typed at cursor position */
	word: string;
	/** Start index of the word in the textarea value */
	startIndex: number;
	/** End index of the word in the textarea value */
	endIndex: number;
}

/**
 * Configuration options for TextareaSuggest
 */
export interface TextareaSuggestOptions {
	/** Minimum characters before showing suggestions (default: 2) */
	minChars?: number;
	/** Maximum number of suggestions to show (default: 8) */
	maxSuggestions?: number;
	/** Debounce delay in milliseconds (default: 150) */
	debounceMs?: number;
}
