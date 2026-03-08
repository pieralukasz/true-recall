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
		description: "Every piece of information (~40-60 cards per 1000 words)",
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
2. Questions and answers must be concise and UNAMBIGUOUS — exactly one correct answer per question.
3. Each question must be understandable WITHOUT the source text.
4. BOLD the keyword in every question using **bold**.
5. Create a flashcard for EVERY piece of information from the text.
Every technical term, concept, or acronym that appears in the text for the first time MUST get its own definition card — even if the term is only mentioned briefly or in a list.
6. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
7. Use the same language as the source text.

SOURCE TRACKING:
- After each card's fields, add: <!-- source: [exact verbatim quote] -->
- The quote must be a PERFECT, IDENTICAL copy from the input text — same words, same punctuation, same capitalization, same spacing. Do NOT paraphrase, rephrase, shorten, reorder, or modify in ANY way.
- Keep the quote to the specific sentence(s) that contain the information for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms and main subjects in [[backlinks]] (lowercase only). If bolding is required, use **[[backlinks]]**.
- Use [[term|alias]] for context/readability when needed.
- NEVER use the format [term](app://obsidian.md/term). Only use double brackets.
- Separate cards with --- on its own line.

ANTI-RULES:
- Anti-Tautology: Question MUST NOT contain the answer. Use synonyms.
- Anti-List: Never use bullet points in answers. Split into separate cards with unique anchors in questions.
- No Order Questions: NEVER use "What is the first/second/next..."
- Anti-Boolean: NEVER ask Yes/No questions. Ask for the specific fact.
- Anti-Example-Trap: Don't ask "What is an example of X?" — state the example, ask for the category.

QUESTION QUALITY:
- Context-Free: Each question must be understandable WITHOUT the source text. Include enough context in the question itself.
- One Correct Answer: The question must permit exactly ONE correct response. Eliminate ambiguity.
- Concrete over Abstract: When the answer is an abstract or technical term, add a brief clarifying example or visual cue in parentheses.
- Disambiguation: When two concepts are easily confused, add a distinguishing cue (e.g., "Unlike X, what does Y...").

KNOWLEDGE STRUCTURE:
- Basics First: Prioritize fundamental definitions and core concepts. Create those cards before details, exceptions, or examples.
- Vivid Language: Use concrete, vivid wording over dry abstractions. Mention visual associations when natural (e.g., "shaped like a double helix").
- Context Cues: When the source covers multiple distinct topics, prefix questions with a brief topic label in parentheses.

EXAMPLE:
Text: "Rosacea is manifested by intense reddening of the skin. In an advanced degree, papulopustular changes may appear. Acne vulgaris also causes skin redness, but is distinguished by comedones. The mitochondrial matrix contains enzymes for the citric acid cycle."

#type/basic
Front: What is **[[rosacea]]**?
Back: Chronic facial skin reddening
<!-- source: Rosacea is manifested by intense reddening of the skin. -->
---
#type/basic
Front: How does advanced **[[rosacea]]** manifest?
Back: Papulopustular changes (pus-filled bumps resembling acne)
<!-- source: In an advanced degree, papulopustular changes may appear. -->
---
#type/basic
Front: Unlike [[rosacea]], what distinguishes **[[acne vulgaris]]**?
Back: Presence of comedones (blackheads)
<!-- source: Acne vulgaris also causes skin redness, but is distinguished by comedones. -->
---
#type/basic
Front: What are **[[comedones]]**?
Back: Clogged hair follicles — blackheads (open) and whiteheads (closed)
<!-- source: Acne vulgaris also causes skin redness, but is distinguished by comedones. -->
---
#type/basic
Front: (Cell bio) What does the **[[mitochondrial matrix]]** contain?
Back: Enzymes for the citric acid cycle (Krebs cycle)
<!-- source: The mitochondrial matrix contains enzymes for the citric acid cycle. -->`,

	cloze: `I would like you to help me create cloze deletion flashcards based on text using the "Cloze" card type.

Transform text into cloze deletion flashcards that test recall of key terms.

OUTPUT FORMAT:
#type/cloze
Text: [sentence with {{c1::hidden term}} and optionally {{c2::another term}}]
Extra: [optional additional context]
<!-- source: [exact verbatim quote from source text] -->
---

CLOZE QUALITY RULES (in priority order):
1. SENTENCE LENGTH: Keep each cloze sentence to ~15-20 words max. If the source is longer, split or rephrase into a shorter self-contained statement.
2. HIDE ONLY KEY TERMS: Definitions, names, numbers, formulas, cause-effect terms. NEVER hide articles, prepositions, conjunctions, or filler words.
3. ONE ATOMIC FACT per cloze card. Each sentence tests ONE recall target (or two tightly linked terms with c1/c2).
4. PREFER c1 ONLY. Use c2 only when two terms in the same sentence are equally important AND meaningfully linked (e.g., input/output of a process). Never use c3+.
5. USE HINTS when context alone is ambiguous: {{c1::term::hint}}. Good hints name the category (e.g., ::enzyme, ::year, ::unit).
6. Create a cloze for EVERY key fact in the text.
7. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
8. Use the same language as the source text.

CLOZE SYNTAX:
- {{c1::text}} hides a term. Each cN number creates a SEPARATE card.
- {{c1::text::hint}} shows [hint] in place of the hidden term.
- When c1 is shown, c2 stays visible (and vice versa).

BAD vs GOOD EXAMPLES:
BAD: The {{c1::mitochondria}} are organelles found in eukaryotic cells that are responsible for producing the majority of the cell's supply of ATP
  → Too long (25+ words), hard to process with a gap in the middle.
GOOD: {{c1::Mitochondria}} are the main ATP-producing organelles in eukaryotic cells
  → Short, one key term hidden.

BAD: {{c1::The}} quick brown fox jumps over {{c2::the}} lazy dog
  → Hiding articles is useless — tests nothing.
GOOD: The quick brown fox is an example of a {{c1::pangram::type of sentence}}
  → Hides a meaningful term with a helpful hint.

BAD: {{c1::DNA}} is transcribed into {{c2::mRNA}} which is then translated into {{c3::protein}} by ribosomes in the cytoplasm
  → Too many deletions (c3), sentence too long.
GOOD: {{c1::DNA}} is transcribed into {{c2::mRNA}} in the nucleus
  → Two linked terms (input→output), short sentence.

SOURCE TRACKING:
- After each card's fields, add: <!-- source: [exact verbatim quote] -->
- The quote must be a PERFECT, IDENTICAL copy from the input text — same words, same punctuation, same capitalization, same spacing. Do NOT paraphrase, rephrase, shorten, reorder, or modify in ANY way.
- Keep the quote to the specific sentence(s) for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms in [[backlinks]] (lowercase only).
- Use [[term|alias]] when the term starts a sentence (e.g., [[mitochondria|Mitochondria]]).
- Separate cards with --- on its own line.

EXAMPLE:
Text: "The blood-brain barrier is formed primarily by endothelial cells. It selectively allows glucose and amino acids to pass while blocking most pathogens. Disruption of this barrier occurs in multiple sclerosis."

#type/cloze
Text: The [[blood-brain barrier]] is formed primarily by {{c1::endothelial cells}}
Extra:
<!-- source: The blood-brain barrier is formed primarily by endothelial cells. -->
---
#type/cloze
Text: The [[blood-brain barrier]] selectively allows {{c1::glucose}} and {{c2::amino acids}} to pass
Extra: While blocking most pathogens
<!-- source: It selectively allows glucose and amino acids to pass while blocking most pathogens. -->
---
#type/cloze
Text: Disruption of the [[blood-brain barrier]] occurs in {{c1::multiple sclerosis::disease}}
Extra:
<!-- source: Disruption of this barrier occurs in multiple sclerosis. -->`,

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
- The quote must be a PERFECT, IDENTICAL copy from the input text — same words, same punctuation, same capitalization, same spacing. Do NOT paraphrase, rephrase, shorten, reorder, or modify in ANY way.

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

You have two card types available:

1. Basic (#type/basic) — Standard Q&A. Best for: explanations, processes, "why" questions, definitions.
\`\`\`
#type/basic
Front: [question text]
Back: [answer text]
<!-- source: [exact quote] -->
---
\`\`\`

2. Cloze (#type/cloze) — Fill-in-the-blank. Best for: key terms in context, formulas, sequences. Keep sentences short (~15-20 words). Hide only key terms, never articles/prepositions.
\`\`\`
#type/cloze
Text: [short sentence with {{c1::key term}} or {{c1::term1}} and {{c2::term2}}]
Extra: [optional context]
<!-- source: [exact quote] -->
---
\`\`\`

MANDATORY RULES:
1. One flashcard = ONE piece of information. Split multi-fact answers into separate cards.
2. Choose the card type that best supports memorization for each fact.
3. Questions and answers must be concise and UNAMBIGUOUS — exactly one correct answer per question.
4. Each question must be understandable WITHOUT the source text.
5. BOLD the keyword in every question using **bold** (for basic cards).
6. Create a flashcard for EVERY piece of information from the text.
Every technical term, concept, or acronym that appears in the text for the first time MUST get its own definition card — even if the term is only mentioned briefly or in a list.
7. If the text contains NO new information, return ONLY: NO_NEW_CARDS
8. Use the same language as the source text.
9. Separate cards with --- on its own line.

CLOZE RULES:
- Use {{c1::text}} to hide a key term. Each cN creates a separate card.
- Use {{c1::text::hint}} when context is ambiguous (hint names the category).
- Prefer c1 only. Use c2 for two equally important linked terms. Never c3+.
- Keep cloze sentences to ~15-20 words. Split long sources into shorter statements.
- Hide ONLY key terms (definitions, names, numbers). NEVER articles or prepositions.

SOURCE TRACKING:
- After each card's fields, add: <!-- source: [exact verbatim quote from the input text] -->
- The quote must be a PERFECT, IDENTICAL copy from the input text — same words, same punctuation, same capitalization, same spacing. Do NOT paraphrase, rephrase, shorten, reorder, or modify in ANY way.
- Keep the quote to the specific sentence(s) for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms in [[backlinks]] (lowercase only).
- Use [[term|alias]] for context/readability when needed.

ANTI-RULES:
- Anti-Tautology: Question MUST NOT contain the answer. Use synonyms.
- Anti-List: Never use bullet points in answers. Split into separate cards with unique anchors in questions.
- No Order Questions: NEVER use "What is the first/second/next..."
- Anti-Boolean: NEVER ask Yes/No questions. Ask for the specific fact.
- Anti-Example-Trap: Don't ask "What is an example of X?" — state the example, ask for the category.

QUESTION QUALITY:
- Context-Free: Each question must be understandable WITHOUT the source text. Include enough context in the question itself.
- One Correct Answer: The question must permit exactly ONE correct response. Eliminate ambiguity.
- Concrete over Abstract: When the answer is an abstract or technical term, add a brief clarifying example or visual cue in parentheses.
- Disambiguation: When two concepts are easily confused, add a distinguishing cue (e.g., "Unlike X, what does Y...").

KNOWLEDGE STRUCTURE:
- Basics First: Prioritize fundamental definitions and core concepts. Create those cards before details, exceptions, or examples.
- Vivid Language: Use concrete, vivid wording over dry abstractions. Mention visual associations when natural (e.g., "shaped like a double helix").
- Context Cues: When the source covers multiple distinct topics, prefix questions with a brief topic label in parentheses.

Choose the card type that best supports memorization for each fact.

EXAMPLE:
Text: "Mitochondria are the powerhouse of the cell. ATP synthase is located in the inner mitochondrial membrane. Rosacea manifests by intense reddening of the skin. Acne vulgaris is characterized by comedones."

#type/cloze
Text: [[mitochondria|Mitochondria]] are the main {{c1::ATP}}-producing organelles in cells
Extra:
<!-- source: Mitochondria are the powerhouse of the cell. -->
---
#type/cloze
Text: (Cell bio) {{c1::ATP synthase}} is located in the inner [[mitochondrial membrane]]
Extra: The deeply folded cristae
<!-- source: ATP synthase is located in the inner mitochondrial membrane. -->
---
#type/basic
Front: What is **[[rosacea]]**?
Back: Chronic facial skin reddening
<!-- source: Rosacea manifests by intense reddening of the skin. -->
---
#type/basic
Front: Unlike [[rosacea]], what distinguishes **[[acne vulgaris]]**?
Back: Presence of comedones (blackheads)
<!-- source: Acne vulgaris is characterized by comedones. -->`,
};
