/**
 * Dynamic Block Format Prompt Builder
 *
 * Generates AI system prompts that produce block-format flashcards.
 * Preserves all quality rules from existing prompts (anti-tautology, bolding,
 * backlinks, atomic cards, source tracking) while adapting output format
 * to NoteType-aware blocks.
 */

import type { NoteType } from "@shared/types/note.types";
import { resolveSlug } from "@features/study/services/flashcard/note-type-slug";

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
- No Order Questions: NEVER use "What is the first/second/next..."`;

const CLOZE_RULES = `CLOZE SYNTAX RULES:
- Use {{c1::text}} to hide a key term. Each cN number creates a separate card.
- Use {{c1::text::hint}} to provide a hint shown as [hint] on the question side.
- Use incrementing numbers (c1, c2, c3...) for multiple deletions in one sentence.
- Each cloze number becomes a separate flashcard. When card c1 is shown, c2 and c3 are visible.
- Hide only KEY TERMS worth memorizing (definitions, names, numbers, relationships).
- Do NOT hide common words, articles, or prepositions.`;

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
	const intro = `I would like you to help me create flashcards based on text. Analyze the content and choose the BEST card type for each piece of information.

You have these card types available:`;

	const typeDescriptions = noteTypes.map((nt) => {
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
Text: "Mitochondria are the powerhouse of the cell. They produce ATP through oxidative phosphorylation."

#type/${slug}
${noteType.fields[0]}: [[mitochondria|Mitochondria]] are the {{c1::powerhouse}} of the cell
${noteType.fields[1] ? `${noteType.fields[1]}: ` : ""}
<!-- source: Mitochondria are the powerhouse of the cell. -->
---
#type/${slug}
${noteType.fields[0]}: [[mitochondria|Mitochondria]] produce {{c1::ATP}} through {{c2::oxidative phosphorylation}}
${noteType.fields[1] ? `${noteType.fields[1]}: ` : ""}
<!-- source: They produce ATP through oxidative phosphorylation. -->`;
	}

	// Basic or reversed
	return `EXAMPLE:
Text: "Rosacea is manifested by intense reddening of the skin. In an advanced degree, papulopustular changes may appear."

#type/${slug}
${noteType.fields[0]}: What is **[[rosacea]]**?
${noteType.fields[1]}: Reddening of the skin
<!-- source: Rosacea is manifested by intense reddening of the skin. -->
---
#type/${slug}
${noteType.fields[0]}: How does advanced **[[rosacea]]** manifest?
${noteType.fields[1]}: Papulopustular changes
<!-- source: In an advanced degree, papulopustular changes may appear. -->`;
}

function getFieldDescription(noteType: NoteType, field: string): string {
	const isCloze = noteType.type === 1;
	const fieldLower = field.toLowerCase();

	if (isCloze && fieldLower === "text") return "sentence with {{c1::hidden term}}";
	if (isCloze && fieldLower === "extra") return "optional additional context";
	if (fieldLower === "front") return "question text";
	if (fieldLower === "back") return "answer text";

	return `${field.toLowerCase()} content`;
}

function getTypeHint(noteType: NoteType): string {
	if (noteType.type === 1) return " — Fill-in-the-blank. Best for: key terms in context, formulas, sequences.";

	const hasMultipleTemplates = noteType.templates.length > 1;
	if (hasMultipleTemplates) return " — Bidirectional Q&A. Best for: term↔definition, symbol↔name pairs.";

	return " — Standard Q&A. Best for: explanations, processes, definitions.";
}
