import { buildLanguageSuffix } from "@features/ai/prompts/default-prompts";
import { resolveSlug } from "@features/study/services/flashcard/note-type-slug";
import type { NoteType } from "@shared/types/note.types";

export function buildCardFormatSpec(noteType: NoteType): string {
	const slug = resolveSlug(noteType);
	const entries = noteType.fields.map((f) => `"${f}": "..."`).join(", ");
	return `Output a JSON array. Each element: {"type": "${slug}", ${entries}, "source": "verbatim quote from text"}\nReturn ONLY the raw JSON array.`;
}

export function buildByokPrompt(
	noteType: NoteType,
	languageCode: string,
	customPrompt?: string,
): string {
	const slug = resolveSlug(noteType);
	const entries = noteType.fields.map((f) => `"${f}": "..."`).join(", ");
	const langSuffix = buildLanguageSuffix(languageCode);
	const custom = customPrompt?.trim();

	return (
		"Generate flashcards from the provided text.\n\n" +
		(custom ? custom + "\n\n" : "") +
		`Output a JSON array. Each element:\n{"type": "${slug}", ${entries}, "source": "verbatim quote from text"}\n\n` +
		"The \"source\" field must be the exact sentence from the input that supports the card.\n" +
		"Return ONLY the raw JSON array. No markdown fences, no explanation." +
		langSuffix
	);
}
