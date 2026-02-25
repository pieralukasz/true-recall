export type GenerationMode = "basic" | "cloze" | "reversed" | "auto";

export const GENERATION_MODE_LABELS: Record<GenerationMode, string> = {
	basic: "Basic",
	cloze: "Cloze",
	reversed: "Reversed",
	auto: "Auto",
};

export const DEFAULT_PROMPTS: Record<GenerationMode, string> = {
	basic: `I would like you to help me create flashcards based on text. Here are the guidelines for creating them.

Transform text into atomic, high-retention flashcards.

OUTPUT FORMAT:
[Question text] #flashcard
[Answer text]
<!-- source: [exact verbatim quote from source text] -->

(Note: The #flashcard tag belongs to the question line. The answer must NOT contain the #flashcard tag.)

MANDATORY RULES:
1. Do NOT number questions and answers. Only write question and answer.
2. Questions and answers must be concise.
3. One flashcard = ONE piece of information. If answer has multiple facts, create SEPARATE flashcards for each.
4. If multiple items must be in one answer, write them on separate lines, each preceded by a dot.
5. Create a flashcard for EVERY piece of information from the text.
6. Formulate questions and answers UNAMBIGUOUSLY. Each question leads to one specific answer.
7. Each flashcard has ONE keyword or concept in the question. Exception: answer may have multiple words only if stored as a fixed unit in memory.
8. We ask questions for each piece of information in each line of text.
9. If several flashcards would have IDENTICAL questions or differ only by one word in answer, MERGE them. List elements on separate lines with dots. Ideally, there should only be one piece of information in the response. If there are more than one, create separate flashcards with separate questions.
10. BOLD the keyword in every question using **bold**.
11. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
12. Use the same language as the source text for questions and answers.

SOURCE TRACKING:
- After each answer, on a NEW LINE, add an HTML comment with the exact verbatim quote from the source text.
- Format: <!-- source: [exact quote] -->
- The quote must be EXACTLY copied from the input text (same words, same punctuation). Do NOT paraphrase.
- Keep the quote to the specific sentence(s) that contain the information for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms and main subjects in [[backlinks]] (lowercase only). If bolding is required by other rules, use **[[backlinks]]**.
- Use [[term|alias]] for context/readability when needed.
- NEVER use the format [term](app://obsidian.md/term). Only use double brackets.
- No Separators: Do NOT place --- between flashcards.

ANTI-RULES:
- Anti-Tautology: Question MUST NOT contain the answer. Use synonyms.
- Anti-List: Never use bullet points in answers. Use unique "anchors" in questions to split lists.
- No Order Questions: NEVER use "What is the first/second/next..."

EXAMPLE:
Text: "Rosacea is manifested by intense reddening of the skin. In an advanced degree, papulopustular changes may appear."

What is **[[rosacea]]**? #flashcard
Reddening of the skin
<!-- source: Rosacea is manifested by intense reddening of the skin. -->

How does advanced **[[rosacea]]** manifest? #flashcard
Papulopustular changes
<!-- source: In an advanced degree, papulopustular changes may appear. -->`,

	cloze: `I would like you to help me create cloze deletion flashcards based on text.

Transform text into cloze deletion flashcards where key terms are hidden.

OUTPUT FORMAT:
[Sentence with {{c1::hidden term}} and optionally {{c2::another term}}] #flashcard
[Optional additional context]
<!-- source: [exact verbatim quote from source text] -->

(Note: The #flashcard tag belongs to the question line. Use {{c1::text}} syntax for cloze deletions.)

CLOZE SYNTAX RULES:
- Use {{c1::text}} to hide a key term. Each cN number creates a separate card.
- Use {{c1::text::hint}} to provide a hint shown as [hint] on the question side.
- Use incrementing numbers (c1, c2, c3...) for multiple deletions in one sentence.
- Each cloze number becomes a separate flashcard. When card c1 is shown, c2 and c3 are visible.

MANDATORY RULES:
1. One cloze flashcard = ONE sentence or closely related pair of sentences.
2. Hide only KEY TERMS that are worth memorizing (definitions, names, numbers, relationships).
3. Do NOT hide common words, articles, or prepositions.
4. Create a cloze flashcard for EVERY key fact in the text.
5. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
6. Use the same language as the source text.
7. Do NOT number flashcards or add separators.

SOURCE TRACKING:
- After each answer (or after the cloze line if no additional context), on a NEW LINE, add: <!-- source: [exact verbatim quote] -->
- The quote must be EXACTLY copied from the input text. Do NOT paraphrase.
- Keep the quote to the specific sentence(s) for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms in [[backlinks]] (lowercase only).
- No Separators: Do NOT place --- between flashcards.

EXAMPLE:
Text: "Mitochondria are the powerhouse of the cell. They produce ATP through oxidative phosphorylation."

[[mitochondria|Mitochondria]] are the {{c1::powerhouse}} of the cell #flashcard
<!-- source: Mitochondria are the powerhouse of the cell. -->

[[mitochondria|Mitochondria]] produce {{c1::ATP}} through {{c2::oxidative phosphorylation}} #flashcard
<!-- source: They produce ATP through oxidative phosphorylation. -->`,

	reversed: `I would like you to help me create reversed flashcards based on text. Reversed flashcards create TWO cards from one: the original Q→A and a reversed A→Q card.

Transform text into reversed flashcards for bidirectional recall.

OUTPUT FORMAT:
[Question text] #flashcard-reverse
[Answer text]
<!-- source: [exact verbatim quote from source text] -->

(Note: Use #flashcard-reverse tag instead of #flashcard. This automatically creates both a forward and backward card.)

MANDATORY RULES:
1. Use reversed cards for term↔definition pairs, symbol↔meaning pairs, or any bidirectional relationship.
2. Questions and answers must be concise and work BOTH WAYS (Q→A and A→Q must both make sense).
3. One flashcard = ONE bidirectional relationship.
4. Create a reversed flashcard for EVERY bidirectional fact in the text.
5. BOLD the keyword in every question using **bold**.
6. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
7. Use the same language as the source text.
8. Do NOT number flashcards or add separators.

SOURCE TRACKING:
- After each answer, on a NEW LINE, add: <!-- source: [exact verbatim quote] -->
- The quote must be EXACTLY copied from the input text. Do NOT paraphrase.

FORMATTING:
- Backlinks: Wrap key scientific terms in [[backlinks]] (lowercase only).
- No Separators: Do NOT place --- between flashcards.

EXAMPLE:
Text: "The capital of France is Paris. The chemical symbol for gold is Au."

What is the capital of **[[france]]**? #flashcard-reverse
Paris
<!-- source: The capital of France is Paris. -->

What is the chemical symbol for **[[gold]]**? #flashcard-reverse
Au
<!-- source: The chemical symbol for gold is Au. -->`,

	auto: `I would like you to help me create flashcards based on text. Analyze the content and choose the BEST card type for each piece of information.

You have three card types available:

1. BASIC (#flashcard) — Standard Q&A. Best for: explanations, processes, "why" questions, definitions.
   Format: [Question] #flashcard
   [Answer]
   <!-- source: [exact quote] -->

2. CLOZE (#flashcard) — Fill-in-the-blank. Best for: key terms in context, formulas, sequences.
   Format: [Sentence with {{c1::hidden term}}] #flashcard
   [Optional context]
   <!-- source: [exact quote] -->

3. REVERSED (#flashcard-reverse) — Bidirectional Q&A. Best for: term↔definition, symbol↔name, translation pairs.
   Format: [Question] #flashcard-reverse
   [Answer]
   <!-- source: [exact quote] -->

MANDATORY RULES:
1. One flashcard = ONE piece of information.
2. Choose the card type that best supports memorization for each fact.
3. Questions and answers must be concise.
4. BOLD the keyword in every question using **bold** (for basic and reversed).
5. Create a flashcard for EVERY piece of information from the text.
6. If the text contains NO new information, return ONLY: NO_NEW_CARDS
7. Use the same language as the source text.
8. Do NOT number flashcards or add separators (no ---).

SOURCE TRACKING:
- After each answer, on a NEW LINE, add: <!-- source: [exact verbatim quote from the input text] -->
- The quote must be EXACTLY copied from the input (same words, same punctuation). Do NOT paraphrase.
- Keep the quote to the specific sentence(s) for that flashcard.

FORMATTING:
- Backlinks: Wrap key scientific terms in [[backlinks]] (lowercase only).
- Use [[term|alias]] for context/readability when needed.

EXAMPLE:
Text: "Mitochondria are the powerhouse of the cell. The chemical symbol for gold is Au. Rosacea manifests by intense reddening of the skin."

[[mitochondria|Mitochondria]] are the {{c1::powerhouse}} of the cell #flashcard
<!-- source: Mitochondria are the powerhouse of the cell. -->

What is the chemical symbol for **[[gold]]**? #flashcard-reverse
Au
<!-- source: The chemical symbol for gold is Au. -->

What is **[[rosacea]]**? #flashcard
Intense reddening of the skin
<!-- source: Rosacea manifests by intense reddening of the skin. -->`,
};
