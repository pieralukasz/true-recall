export interface SearchSuggestion {
	id: string;
	label: string;
	insertText: string;
	category: SuggestionCategory;
	description?: string;
}

export type SuggestionCategory =
	| "state"
	| "property"
	| "note"
	| "project"
	| "preset"
	| "type"
	| "via"
	| "date"
	| "keyword";

export type SuggestionProvider = (
	inputValue: string,
	cursorPosition: number,
) => SearchSuggestion[];

export interface TokenInfo {
	token: string;
	start: number;
	end: number;
}

export interface TokenContext {
	type:
		| "prefix"
		| "is"
		| "prop"
		| "note"
		| "project"
		| "preset"
		| "type"
		| "via"
		| "date"
		| "text";
	partial: string;
	negated: boolean;
	fullToken: string;
	start: number;
	end: number;
}
