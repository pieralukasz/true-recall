export const GENERATION_LANGUAGES = [
	{ value: "auto", label: "Auto-detect (match source text)" },
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "it", label: "Italian" },
	{ value: "pt", label: "Portuguese" },
	{ value: "nl", label: "Dutch" },
	{ value: "ru", label: "Russian" },
	{ value: "uk", label: "Ukrainian" },
	{ value: "pl", label: "Polish" },
	{ value: "cs", label: "Czech" },
	{ value: "tr", label: "Turkish" },
	{ value: "ar", label: "Arabic" },
	{ value: "hi", label: "Hindi" },
	{ value: "ja", label: "Japanese" },
	{ value: "zh-CN", label: "Chinese (Simplified)" },
	{ value: "zh-TW", label: "Chinese (Traditional)" },
	{ value: "ko", label: "Korean" },
	{ value: "vi", label: "Vietnamese" },
	{ value: "th", label: "Thai" },
	{ value: "id", label: "Indonesian" },
	{ value: "sv", label: "Swedish" },
	{ value: "no", label: "Norwegian" },
	{ value: "da", label: "Danish" },
	{ value: "fi", label: "Finnish" },
	{ value: "el", label: "Greek" },
	{ value: "ro", label: "Romanian" },
	{ value: "hu", label: "Hungarian" },
	{ value: "he", label: "Hebrew" },
] as const;

/**
 * Baseline quality rules injected into every wrapped generation prompt
 * (basic builtin, user presets, BYOK). The Pro builtin carries its own
 * richer ruleset (builtin-basic-pro.prompt.ts) and bypasses this wrapper.
 */
export const CARD_QUALITY_RULES = `
Card quality rules (apply unless the preset instructions below explicitly say otherwise):
- ATOMIC: one card = one fact. When an answer would contain two independent facts, output two cards instead.
- SELF-CONTAINED: every question must make sense on its own years later, without the source note. Never reference the text's structure or order — no "first/second/next rule", "one of the...", "according to the text", and no questions about an item's position in a list.
- SINGLE ANSWER: exactly one correct answer per question given the source. Ask condition → concept; never "which of the N...".
- CONCISE ANSWERS: a short phrase (1-3 words when possible, at most one sentence for definitions). Never a wall of text and never a list in an answer — split into more cards.
- SOURCE FIDELITY: never invent terms, labels, or facts that are not in the provided text.
`.trim();

export function buildLanguageSuffix(languageCode: string): string {
	if (languageCode === "auto") return "";
	const label =
		GENERATION_LANGUAGES.find((l) => l.value === languageCode)?.label ??
		languageCode;
	return `\n\nLANGUAGE: Generate ALL flashcard content (questions, answers, cloze text) in ${label}. This overrides any other language instructions.`;
}
