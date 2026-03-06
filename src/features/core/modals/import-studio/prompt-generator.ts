/**
 * Generates NoteType-specific AI prompts for Import Studio.
 *
 * Produces block-format prompts that users can paste into ChatGPT/Claude
 * to generate flashcards in the correct #type/<slug> format.
 */

import { resolveSlug } from "@features/study/services/flashcard/note-type-slug";
import type { NoteType } from "@shared/types/note.types";

/**
 * Returns an AI prompt string tailored to the given NoteType using block format.
 */
export function generateImportPrompt(noteType: NoteType): string {
	const slug = resolveSlug(noteType);
	const isCloze = noteType.type === 1;

	const fieldExample = noteType.fields
		.map((f) => `${f}: [${f.toLowerCase()}]`)
		.join("\n");

	const format = `#type/${slug}
${fieldExample}
---`;

	let example: string;
	if (isCloze) {
		example = `#type/${slug}
${noteType.fields[0]}: [[mitochondria|Mitochondria]] are the {{c1::powerhouse}} of the cell
${noteType.fields[1] ? `${noteType.fields[1]}: ` : ""}
---`;
	} else if (noteType.fields.length === 2) {
		example = `#type/${slug}
${noteType.fields[0]}: What is **[[photosynthesis]]**?
${noteType.fields[1]}: Process of converting light energy to chemical energy
---`;
	} else {
		example = `#type/${slug}
${noteType.fields.map((f) => `${f}: [example ${f.toLowerCase()}]`).join("\n")}
---`;
	}

	return `Generate flashcards about [TOPIC] using this exact block format:

${format}

Rules:
- Each card starts with #type/${slug}
- Separate cards with --- on its own line
- One atomic fact per card
- Bold key terms with **bold**
- Wrap important terms in [[backlinks]]
- No numbering or bullets
${isCloze ? "- Use {{c1::text}} for cloze deletions\n" : ""}
Example:
${example}`;
}
