import type { CardPolishPreset, CardPolishSettings } from "@true-recall/core";

const FIX_FORMATTING_PROMPT = `Repair markdown structure in the flashcard: tables, lists, code blocks, headings, and escaping. Do not change the content's meaning or add new facts — preserve wording as-is, only restructure. If a table is broken into a flat line because it used tabs or pipes without proper row separators, rewrite it as a valid markdown table.`;

const SIMPLIFY_PROMPT = `Rephrase the flashcard for clarity. Use simpler sentences and plain language. Preserve all key facts and technical terms. Do not shorten below the information needed to answer the card.`;

const SHORTEN_PROMPT = `Compress the flashcard without dropping the main point. The back should be at most 3 sentences. Preserve the front verbatim unless it is clearly redundant.`;

export const DEFAULT_CARD_POLISH_PRESETS: CardPolishPreset[] = [
	{
		id: "builtin-fix-formatting",
		name: "Fix formatting",
		prompt: FIX_FORMATTING_PROMPT,
		autoApply: true,
		builtin: true,
	},
	{
		id: "builtin-simplify",
		name: "Simplify",
		prompt: SIMPLIFY_PROMPT,
		autoApply: false,
		builtin: true,
	},
	{
		id: "builtin-shorten",
		name: "Shorten",
		prompt: SHORTEN_PROMPT,
		autoApply: false,
		builtin: true,
	},
];

export const DEFAULT_CARD_POLISH_SETTINGS: CardPolishSettings = {
	presets: DEFAULT_CARD_POLISH_PRESETS,
	customPromptAutoApply: false,
};
