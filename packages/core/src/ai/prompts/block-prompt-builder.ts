import { resolveSlug } from "../../flashcard/note-types/note-type-slug";
import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import { buildLanguageSuffix, CARD_QUALITY_RULES } from "./default-prompts";

export function buildPresetPrompt(
	preset: GenerationPreset,
	noteType: NoteType,
): string {
	const slug = resolveSlug(noteType);
	const textFields = noteType.fields;
	const entries = textFields.map((name) => `"${name}": "..."`).join(", ");
	const userPrompt = preset.prompt.trim();

	return (
		"Generate flashcards from the provided text.\n\n" +
		`${CARD_QUALITY_RULES}\n\n` +
		(userPrompt ? `${userPrompt}\n\n` : "") +
		`Fields to fill: ${textFields.join(", ")}\n\n` +
		`Output a JSON array. Each element:\n{"type": "${slug}", ${entries}, "source": "..."}\n\n` +
		'"source" = copy-paste one sentence from the input that proves this fact. Must be an EXACT substring of the input (character-perfect) — any mismatch breaks highlighting. Preserve ALL markdown formatting (**, *, ~~, ==, `, #, -, etc.). Copy raw markdown, not rendered text. Never paraphrase.\n' +
		"Return ONLY the raw JSON array. No markdown fences, no explanation."
	);
}

export function buildPresetFormatSpec(noteType: NoteType): string {
	const slug = resolveSlug(noteType);
	const textFields = noteType.fields;
	const entries = textFields.map((name) => `"${name}": "..."`).join(", ");

	return (
		`Output a JSON array. Each element: {"type": "${slug}", ${entries}, "source": "..."}\n` +
		`Fields to fill: ${textFields.join(", ")}\n` +
		'"source" = copy-paste one sentence from the input that proves this fact. Must be an EXACT substring of the input — any mismatch breaks highlighting. Preserve ALL markdown formatting (**, *, ~~, ==, `, #, -, etc.). Copy raw markdown, not rendered text.\n' +
		"Return ONLY the raw JSON array."
	);
}

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
		`${CARD_QUALITY_RULES}\n\n` +
		(custom ? `${custom}\n\n` : "") +
		`Output a JSON array. Each element:\n{"type": "${slug}", ${entries}, "source": "..."}\n\n` +
		'"source" = copy-paste one sentence from the input that proves this fact. Must be an EXACT substring of the input (character-perfect) — any mismatch breaks highlighting. Preserve ALL markdown formatting (**, *, ~~, ==, `, #, -, etc.). Copy raw markdown, not rendered text. Never paraphrase.\n' +
		"Return ONLY the raw JSON array. No markdown fences, no explanation." +
		langSuffix
	);
}
