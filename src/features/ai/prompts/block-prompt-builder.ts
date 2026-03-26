import { buildLanguageSuffix } from "@features/ai/prompts/default-prompts";
import { resolveSlug } from "@features/study/services/flashcard/note-type-slug";
import type { NoteType } from "@shared/types/note.types";

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
		`Output a JSON array. Each element:\n{"type": "${slug}", ${entries}}\n\n` +
		"Return ONLY the raw JSON array. No markdown fences, no explanation." +
		langSuffix
	);
}
