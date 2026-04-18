import type { CardPolishPreset, CardPolishSettings } from "@true-recall/core";

const FIX_FORMATTING_PROMPT = `Repair markdown structure without changing wording or meaning.

Fix when present:
- Tables flattened into a single line (rebuild with | separators and a header divider row)
- Lists missing newlines or using inconsistent bullets
- Code blocks with missing language tags or unclosed fences
- Unescaped markdown characters that break rendering
- Misaligned or missing heading levels
- LaTeX written as plain text (wrap inline math in $...$, block math in $$...$$)

Strictly preserve: every fact, wording, wikilinks ([[...]]), Obsidian callouts (> [!note]), existing LaTeX, code content, numbers, proper nouns, and the original language of the card. Do not rephrase, translate, shorten, or add content — only restructure.`;

const SIMPLIFY_PROMPT = `Rewrite the flashcard in clearer, simpler language while keeping every factual detail.

Rules:
- Use plain words and shorter sentences
- Keep every technical term, proper noun, number, date, and named entity exactly as written
- Do not add, remove, or invent information
- Respond in the same language as the card (Polish stays Polish, English stays English)
- Preserve markdown, wikilinks, LaTeX, and code blocks verbatim
- If the card is already clear, return it unchanged`;

const SHORTEN_PROMPT = `Compress the flashcard to the shortest form that still lets someone answer it correctly.

Rules:
- Remove filler, redundant phrases, and stylistic repetition — not facts
- Keep every fact, name, number, date, and technical term
- Preserve the front unless it contains obvious redundancy
- No fixed sentence limit — stop when further cuts would lose answerability
- Respond in the same language as the card
- Preserve markdown, wikilinks, LaTeX, and code blocks verbatim`;

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
