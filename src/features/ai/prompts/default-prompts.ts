export type GenerationMode = "basic" | "cloze" | "reversed" | "auto";

export const GENERATION_MODE_LABELS: Record<GenerationMode, string> = {
	basic: "Basic",
	cloze: "Cloze",
	reversed: "Reversed",
	auto: "Auto",
};

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

export type GenerationDensity = "essential" | "balanced" | "comprehensive";

export const GENERATION_DENSITY_OPTIONS: {
	value: GenerationDensity;
	label: string;
	description: string;
}[] = [
	{
		value: "essential",
		label: "Essential",
		description:
			"Only core concepts and definitions (~5-10 cards per 1000 words)",
	},
	{
		value: "balanced",
		label: "Balanced",
		description:
			"Main ideas and important details (~15-25 cards per 1000 words)",
	},
	{
		value: "comprehensive",
		label: "Comprehensive",
		description:
			"Every piece of information (~40-60 cards per 1000 words)",
	},
];

export function buildDensitySuffix(density: GenerationDensity): string {
	switch (density) {
		case "essential":
			return "\n\nDENSITY OVERRIDE: Ignore the rule about creating a flashcard for every piece of information. Instead, focus ONLY on the most important concepts: key definitions, core principles, critical formulas, and fundamental relationships. Skip examples, minor details, and supporting evidence. Aim for approximately 5-10 flashcards per 1000 words of source text.";
		case "balanced":
			return "\n\nDENSITY OVERRIDE: Ignore the rule about creating a flashcard for every piece of information. Instead, cover main concepts and important supporting details, but skip trivial facts, redundant examples, and minor points. Aim for approximately 15-25 flashcards per 1000 words of source text.";
		case "comprehensive":
			return "";
	}
}

export function buildLanguageSuffix(languageCode: string): string {
	if (languageCode === "auto") return "";
	const label =
		GENERATION_LANGUAGES.find((l) => l.value === languageCode)?.label ??
		languageCode;
	return `\n\nLANGUAGE: Generate ALL flashcard content (questions, answers, cloze text) in ${label}. This overrides any other language instructions.`;
}

export const DEFAULT_PROMPTS: Record<GenerationMode, string> = {
	basic: `I would like you to help me create flashcards based on text using the "Basic" card type.

Transform text into atomic, high-retention flashcards.

OUTPUT FORMAT:
#type/basic
Front: [question text]
Back: [answer text]
<!-- source: [exact verbatim quote from source text] -->
---

MANDATORY RULES:
1. One flashcard = ONE piece of information. If answer has multiple facts, create SEPARATE flashcards.
2. Questions and answers must be concise and UNAMBIGUOUS.
3. Create a flashcard for EVERY piece of information from the text.
4. BOLD the keyword in every question using **bold**.
5. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
6. Use the same language as the source text.

SOURCE TRACKING:
- After each card's fields, add: <!-- source: [exact verbatim quote] -->
- The quote must be EXACTLY copied from the input text (same words, same punctuation). Do NOT paraphrase.
- Keep the quote to the specific sentence(s) that contain the information for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms and main subjects in [[backlinks]] (lowercase only). If bolding is required, use **[[backlinks]]**.
- Use [[term|alias]] for context/readability when needed.
- NEVER use the format [term](app://obsidian.md/term). Only use double brackets.
- Separate cards with --- on its own line.

ANTI-RULES:
- Anti-Tautology: Question MUST NOT contain the answer. Use synonyms.
- Anti-List: Never use bullet points in answers. Use unique "anchors" in questions to split lists.
- No Order Questions: NEVER use "What is the first/second/next..."

EXAMPLE:
Text: "Rosacea is manifested by intense reddening of the skin. In an advanced degree, papulopustular changes may appear."

#type/basic
Front: What is **[[rosacea]]**?
Back: Reddening of the skin
<!-- source: Rosacea is manifested by intense reddening of the skin. -->
---
#type/basic
Front: How does advanced **[[rosacea]]** manifest?
Back: Papulopustular changes
<!-- source: In an advanced degree, papulopustular changes may appear. -->`,

	cloze: `I would like you to help me create cloze deletion flashcards based on text using the "Cloze" card type.

Transform text into cloze deletion flashcards where key terms are hidden.

OUTPUT FORMAT:
#type/cloze
Text: [sentence with {{c1::hidden term}} and optionally {{c2::another term}}]
Extra: [optional additional context]
<!-- source: [exact verbatim quote from source text] -->
---

CLOZE SYNTAX RULES:
- Use {{c1::text}} to hide a key term. Each cN number creates a separate card.
- Use {{c1::text::hint}} to provide a hint shown as [hint] on the question side.
- Use incrementing numbers (c1, c2, c3...) for multiple deletions in one sentence.
- Each cloze number becomes a separate flashcard. When card c1 is shown, c2 and c3 are visible.
- Hide only KEY TERMS worth memorizing (definitions, names, numbers, relationships).
- Do NOT hide common words, articles, or prepositions.

MANDATORY RULES:
1. One cloze flashcard = ONE sentence or closely related pair of sentences.
2. Create a cloze flashcard for EVERY key fact in the text.
3. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
4. Use the same language as the source text.

SOURCE TRACKING:
- After each card's fields, add: <!-- source: [exact verbatim quote] -->
- The quote must be EXACTLY copied from the input text. Do NOT paraphrase.
- Keep the quote to the specific sentence(s) for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms in [[backlinks]] (lowercase only).
- Separate cards with --- on its own line.

EXAMPLE:
Text: "Mitochondria are the powerhouse of the cell. They produce ATP through oxidative phosphorylation."

#type/cloze
Text: [[mitochondria|Mitochondria]] are the {{c1::powerhouse}} of the cell
Extra:
<!-- source: Mitochondria are the powerhouse of the cell. -->
---
#type/cloze
Text: [[mitochondria|Mitochondria]] produce {{c1::ATP}} through {{c2::oxidative phosphorylation}}
Extra:
<!-- source: They produce ATP through oxidative phosphorylation. -->`,

	reversed: `I would like you to help me create reversed flashcards based on text using the "Basic (reversed)" card type. Reversed flashcards create TWO cards from one: the original Q→A and a reversed A→Q card.

Transform text into reversed flashcards for bidirectional recall.

OUTPUT FORMAT:
#type/basic-reversed
Front: [question text]
Back: [answer text]
<!-- source: [exact verbatim quote from source text] -->
---

MANDATORY RULES:
1. Use reversed cards for term↔definition pairs, symbol↔meaning pairs, or any bidirectional relationship.
2. Questions and answers must be concise and work BOTH WAYS (Q→A and A→Q must both make sense).
3. One flashcard = ONE bidirectional relationship.
4. Create a reversed flashcard for EVERY bidirectional fact in the text.
5. BOLD the keyword in every question using **bold**.
6. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
7. Use the same language as the source text.

SOURCE TRACKING:
- After each card's fields, add: <!-- source: [exact verbatim quote] -->
- The quote must be EXACTLY copied from the input text. Do NOT paraphrase.

FORMATTING:
- Backlinks: Wrap key scientific terms in [[backlinks]] (lowercase only).
- Separate cards with --- on its own line.

EXAMPLE:
Text: "The capital of France is Paris. The chemical symbol for gold is Au."

#type/basic-reversed
Front: What is the capital of **[[france]]**?
Back: Paris
<!-- source: The capital of France is Paris. -->
---
#type/basic-reversed
Front: What is the chemical symbol for **[[gold]]**?
Back: Au
<!-- source: The chemical symbol for gold is Au. -->`,

	auto: `I would like you to help me create flashcards based on text. Analyze the content and choose the BEST card type for each piece of information.

You have three card types available:

1. Basic (#type/basic) — Standard Q&A. Best for: explanations, processes, "why" questions, definitions.
\`\`\`
#type/basic
Front: [question text]
Back: [answer text]
<!-- source: [exact quote] -->
---
\`\`\`

2. Cloze (#type/cloze) — Fill-in-the-blank. Best for: key terms in context, formulas, sequences.
\`\`\`
#type/cloze
Text: [sentence with {{c1::hidden term}}]
Extra: [optional context]
<!-- source: [exact quote] -->
---
\`\`\`

3. Basic Reversed (#type/basic-reversed) — Bidirectional Q&A. Best for: term↔definition, symbol↔name, translation pairs.
\`\`\`
#type/basic-reversed
Front: [question text]
Back: [answer text]
<!-- source: [exact quote] -->
---
\`\`\`

MANDATORY RULES:
1. One flashcard = ONE piece of information.
2. Choose the card type that best supports memorization for each fact.
3. Questions and answers must be concise and UNAMBIGUOUS.
4. BOLD the keyword in every question using **bold** (for basic and reversed).
5. Create a flashcard for EVERY piece of information from the text.
6. If the text contains NO new information, return ONLY: NO_NEW_CARDS
7. Use the same language as the source text.
8. Separate cards with --- on its own line.

CLOZE SYNTAX RULES:
- Use {{c1::text}} to hide a key term. Each cN number creates a separate card.
- Use {{c1::text::hint}} to provide a hint.
- Use incrementing numbers (c1, c2, c3...) for multiple deletions in one sentence.
- Hide only KEY TERMS worth memorizing.

SOURCE TRACKING:
- After each card's fields, add: <!-- source: [exact verbatim quote from the input text] -->
- The quote must be EXACTLY copied from the input (same words, same punctuation). Do NOT paraphrase.
- Keep the quote to the specific sentence(s) for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms in [[backlinks]] (lowercase only).
- Use [[term|alias]] for context/readability when needed.

ANTI-RULES:
- Anti-Tautology: Question MUST NOT contain the answer. Use synonyms.
- Anti-List: Never use bullet points in answers. Use unique "anchors" in questions to split lists.
- No Order Questions: NEVER use "What is the first/second/next..."

Choose the card type that best supports memorization for each fact.

EXAMPLE:
Text: "Mitochondria are the powerhouse of the cell. The chemical symbol for gold is Au. Rosacea manifests by intense reddening of the skin."

#type/cloze
Text: [[mitochondria|Mitochondria]] are the {{c1::powerhouse}} of the cell
Extra:
<!-- source: Mitochondria are the powerhouse of the cell. -->
---
#type/basic-reversed
Front: What is the chemical symbol for **[[gold]]**?
Back: Au
<!-- source: The chemical symbol for gold is Au. -->
---
#type/basic
Front: What is **[[rosacea]]**?
Back: Intense reddening of the skin
<!-- source: Rosacea manifests by intense reddening of the skin. -->`,
};
