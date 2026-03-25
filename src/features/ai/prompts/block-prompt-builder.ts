import { resolveSlug } from "@features/study/services/flashcard/note-type-slug";
import type { NoteType } from "@shared/types/note.types";

export function buildByokPrompt(noteType: NoteType): string {
	const slug = resolveSlug(noteType);
	const fieldLines = noteType.fields
		.map((f) => `${f}: [value]`)
		.join("\n");

	return `Generate flashcards from the provided text.

Output format — repeat for each card:
#type/${slug}
${fieldLines}
---`;
}
