/**
 * Dynamic Block Format Prompt Builder
 *
 * Generates AI system prompts that produce block-format flashcards.
 * Preserves all quality rules from existing prompts (anti-tautology, bolding,
 * backlinks, atomic cards, source tracking) while adapting output format
 * to NoteType-aware blocks.
 */

import { resolveSlug } from "@features/study/services/flashcard/note-type-slug";
import type { NoteType } from "@shared/types/note.types";

const SHARED_RULES = `MANDATORY RULES:
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
- Anti-Boolean: NEVER ask Yes/No questions. Rephrase to ask for the specific fact.
- Anti-Example-Trap: Don't ask "What is an example of X?" — instead state the example and ask what category/type it belongs to.

QUESTION QUALITY:
- Context-Free: Each question must be understandable WITHOUT the source text. Include enough context in the question itself.
- One Correct Answer: The question must permit exactly ONE correct response. Eliminate ambiguity that could allow alternative correct answers.
- Concrete over Abstract: When the answer is an abstract concept, include a brief concrete example or visual cue.
- Disambiguation: When two concepts are easily confused, add a distinguishing cue (e.g., "Unlike X, what does Y...").

KNOWLEDGE STRUCTURE:
- Basics First: Prioritize fundamental definitions and core concepts. Create those cards before details, exceptions, or examples.
- Vivid Language: Use concrete, vivid wording over dry abstractions. Mention visual associations when natural (e.g., "shaped like a double helix").
- Context Cues: When the source covers multiple distinct topics, prefix questions with a brief topic label in parentheses.`;

const CLOZE_RULES = `CLOZE RULES:
- Keep each cloze sentence to ~15-20 words max. Split long source sentences into shorter statements.
- Hide ONLY key terms: definitions, names, numbers, formulas, relationships. NEVER hide articles, prepositions, or filler.
- Use {{c1::text}} to hide a term. Each cN creates a separate card.
- Use {{c1::text::hint}} when context alone is ambiguous. Good hints name the category (e.g., ::enzyme, ::year).
- Prefer c1 only. Use c2 when two terms are equally important AND linked (e.g., input→output). Never use c3+.
- When card c1 is shown, c2 stays visible (and vice versa).

BAD: The {{c1::mitochondria}} are organelles found in eukaryotic cells that produce the majority of ATP
GOOD: {{c1::Mitochondria}} are the main ATP-producing organelles in eukaryotic cells

BAD: {{c1::DNA}} is transcribed into {{c2::mRNA}} which is translated into {{c3::protein}} by ribosomes
GOOD: {{c1::DNA}} is transcribed into {{c2::mRNA}} in the nucleus`;

/**
 * Build a prompt for a specific NoteType.
 */
export function buildBlockPrompt(noteType: NoteType): string {
	const slug = resolveSlug(noteType);
	const isCloze = noteType.type === 1;

	const intro = `I would like you to help me create flashcards based on text using the "${noteType.name}" card type.

Transform text into atomic, high-retention flashcards.`;

	const formatSection = buildFormatSection(noteType, slug);
	const typeSpecificRules = isCloze ? `\n${CLOZE_RULES}\n` : "";
	const example = buildExample(noteType, slug);

	return `${intro}

OUTPUT FORMAT:
${formatSection}

${SHARED_RULES}
${typeSpecificRules}
${example}`;
}

/**
 * Build a prompt for "auto" mode that lists all available NoteTypes.
 */
export function buildAutoPrompt(noteTypes: NoteType[]): string {
	const filtered = noteTypes.filter(
		(nt) => !(nt.type === 0 && nt.templates.length > 1),
	);

	const intro = `I would like you to help me create flashcards based on text. Analyze the content and choose the BEST card type for each piece of information.

You have these card types available:`;

	const typeDescriptions = filtered.map((nt) => {
		const slug = resolveSlug(nt);
		const fields = nt.fields.map((f) => `${f}: [value]`).join("\n");
		const hint = getTypeHint(nt);
		return `${nt.name} (#type/${slug})${hint}
\`\`\`
#type/${slug}
${fields}
<!-- source: [exact quote] -->
---
\`\`\``;
	});

	return `${intro}

${typeDescriptions.join("\n\n")}

${SHARED_RULES}

${CLOZE_RULES}

Choose the card type that best supports memorization for each fact.`;
}

// ── Helpers ─────────────────────────────────────────────

function buildFormatSection(noteType: NoteType, slug: string): string {
	const lines = [`#type/${slug}`];
	for (const field of noteType.fields) {
		lines.push(`${field}: [${getFieldDescription(noteType, field)}]`);
	}
	lines.push("<!-- source: [exact verbatim quote from source text] -->");
	lines.push("---");
	return lines.join("\n");
}

function buildExample(noteType: NoteType, slug: string): string {
	const isCloze = noteType.type === 1;

	if (isCloze) {
		return `EXAMPLE:
Text: "The blood-brain barrier is formed primarily by endothelial cells. It selectively allows glucose and amino acids to pass while blocking most pathogens."

#type/${slug}
${noteType.fields[0]}: The [[blood-brain barrier]] is formed primarily by {{c1::endothelial cells}}
${noteType.fields[1] ? `${noteType.fields[1]}: ` : ""}
<!-- source: The blood-brain barrier is formed primarily by endothelial cells. -->
---
#type/${slug}
${noteType.fields[0]}: The [[blood-brain barrier]] allows {{c1::glucose}} and {{c2::amino acids}} to pass selectively
${noteType.fields[1] ? `${noteType.fields[1]}: While blocking most pathogens` : ""}
<!-- source: It selectively allows glucose and amino acids to pass while blocking most pathogens. -->`;
	}

	// Basic or reversed
	return `EXAMPLE:
Text: "Rosacea is manifested by intense reddening of the skin. In an advanced degree, papulopustular changes may appear. Acne vulgaris also causes skin redness, but is distinguished by comedones. The mitochondrial matrix contains enzymes for the citric acid cycle."

#type/${slug}
${noteType.fields[0]}: What is **[[rosacea]]**?
${noteType.fields[1]}: Chronic skin condition causing intense facial reddening
<!-- source: Rosacea is manifested by intense reddening of the skin. -->
---
#type/${slug}
${noteType.fields[0]}: How does advanced **[[rosacea]]** manifest?
${noteType.fields[1]}: Papulopustular changes (pus-filled bumps resembling acne)
<!-- source: In an advanced degree, papulopustular changes may appear. -->
---
#type/${slug}
${noteType.fields[0]}: Unlike [[rosacea]], what distinguishes **[[acne vulgaris]]**?
${noteType.fields[1]}: Presence of comedones (blackheads and whiteheads)
<!-- source: Acne vulgaris also causes skin redness, but is distinguished by comedones. -->
---
#type/${slug}
${noteType.fields[0]}: (Cell biology) What does the **[[mitochondrial matrix]]** contain?
${noteType.fields[1]}: Enzymes for the citric acid cycle (Krebs cycle)
<!-- source: The mitochondrial matrix contains enzymes for the citric acid cycle. -->`;
}

function getFieldDescription(noteType: NoteType, field: string): string {
	const isCloze = noteType.type === 1;
	const fieldLower = field.toLowerCase();

	if (isCloze && fieldLower === "text")
		return "sentence with {{c1::hidden term}}";
	if (isCloze && fieldLower === "extra") return "optional additional context";
	if (fieldLower === "front") return "question text";
	if (fieldLower === "back") return "answer text";

	return `${field.toLowerCase()} content`;
}

function getTypeHint(noteType: NoteType): string {
	if (noteType.type === 1)
		return " — Fill-in-the-blank. Best for: key terms in context, formulas, sequences.";

	const hasMultipleTemplates = noteType.templates.length > 1;
	if (hasMultipleTemplates)
		return " — Bidirectional Q&A. Best for: term↔definition, symbol↔name pairs.";

	return " — Standard Q&A. Best for: explanations, processes, definitions.";
}
