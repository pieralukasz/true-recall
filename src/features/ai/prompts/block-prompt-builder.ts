import { resolveSlug } from "@features/study/services/flashcard/note-type-slug";
import type { NoteType } from "@shared/types/note.types";

export function buildCardFormatSpec(noteType: NoteType): string {
	const slug = resolveSlug(noteType);
	const entries = noteType.fields.map((f) => `"${f}": "..."`).join(", ");
	return `Format: {"type": "${slug}", ${entries}}`;
}

export function buildByokSystemPrompt(): string {
	return "Generate flashcards from the provided text.\nReturn a JSON array of card objects matching the specified format.\nReturn ONLY the JSON array.";
}
