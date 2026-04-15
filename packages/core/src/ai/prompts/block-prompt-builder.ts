import { resolveSlug } from "../../flashcard/note-types/note-type-slug";
import type { NoteType } from "../../types/note.types";
import { buildLanguageSuffix, resolveLanguageName } from "./default-prompts";

export function buildCardFormatSpec(noteType: NoteType): string {
	const slug = resolveSlug(noteType);
	const entries = noteType.fields.map((f) => `"${f}": "..."`).join(", ");
	return (
		`Output a JSON array. Each element: {"type": "${slug}", ${entries}, "source": "..."}\n` +
		'"source" = copy-paste one sentence from the input that proves this fact. Must be an EXACT substring of the input — any mismatch breaks highlighting. Preserve ALL markdown formatting (**, *, ~~, ==, `, #, -, etc.). Copy raw markdown, not rendered text.\n' +
		"Return ONLY the raw JSON array."
	);
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
		(custom ? `${custom}\n\n` : "") +
		`Output a JSON array. Each element:\n{"type": "${slug}", ${entries}, "source": "..."}\n\n` +
		'"source" = copy-paste one sentence from the input that proves this fact. Must be an EXACT substring of the input (character-perfect) — any mismatch breaks highlighting. Preserve ALL markdown formatting (**, *, ~~, ==, `, #, -, etc.). Copy raw markdown, not rendered text. Never paraphrase.\n' +
		"Return ONLY the raw JSON array. No markdown fences, no explanation." +
		langSuffix
	);
}

export function buildLanguageByokPrompt(
	noteType: NoteType,
	sourceLanguage: string,
	targetLanguage: string,
	customPrompt?: string,
): string {
	const slug = resolveSlug(noteType);
	const entries = noteType.fields.map((f) => `"${f}": "..."`).join(", ");
	const sourceName = resolveLanguageName(sourceLanguage);
	const targetName = resolveLanguageName(targetLanguage);

	return (
		`You are a language teacher creating vocabulary flashcards for a ${targetName}-speaking student learning ${sourceName}.\n\n` +
		`Extract key vocabulary from the provided text. Create flashcards using the field structure provided.\n` +
		`Interpret field names semantically:\n` +
		`- "Word", "Front", "Term" → content in ${sourceName}\n` +
		`- "Translation", "Back", "Meaning" → content in ${targetName}\n` +
		`- "Example", "Sentence" → example in ${sourceName}\n` +
		`- "Extra", "Notes" → supplementary info in ${targetName}\n` +
		`- "Text" (cloze) → sentence in ${sourceName} with {{c1::word}} syntax\n` +
		`- Other fields: use best judgment based on field name\n\n` +
		(customPrompt ? `${customPrompt}\n\n` : "") +
		`Output a JSON array. Each element:\n{"type": "${slug}", ${entries}, "source": "..."}\n\n` +
		`"source" = copy-paste one sentence from the input. Must be an EXACT substring (character-perfect). Preserve ALL markdown formatting.\n` +
		`Return ONLY the raw JSON array. No markdown fences, no explanation.`
	);
}
