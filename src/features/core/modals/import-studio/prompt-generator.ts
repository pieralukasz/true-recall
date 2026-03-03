/**
 * Generates NoteType-specific AI prompts for Import Studio.
 *
 * Pure function — no side effects, no Obsidian APIs. Safe to call anywhere.
 */

import type { NoteType } from "@shared/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
} from "@shared/types/note.types";

// ── Per-type prompt templates ──────────────────────────────────────────────

const BASIC_PROMPT = (fields: string[]) => {
	const [f, b] = fields;
	return `Generate flashcards about [TOPIC]. Output each flashcard on a single line using this exact format:
${f ?? "Front"} :: ${b ?? "Back"}

Do not add numbering, bullets, or any other formatting. One flashcard per line.`;
};

const BASIC_REVERSED_PROMPT = (fields: string[]) => {
	const [f, b] = fields;
	return `Generate flashcards about [TOPIC]. Each card will be tested both ways (front→back and back→front). Format:
${f ?? "Front"} :: ${b ?? "Back"}

One flashcard per line. No numbering or bullets.`;
};

const CLOZE_PROMPT = (_fields: string[]) =>
	`Generate cloze deletion flashcards about [TOPIC]. Wrap the key fact in each sentence using {{c1::...}} syntax:
The capital of France is {{c1::Paris}}.

One cloze card per line. No numbering or bullets.`;

function buildNFieldPrompt(noteType: NoteType): string {
	const fieldList = noteType.fields.join("\\t");
	const exampleRow = noteType.fields.map((f) => `[${f}]`).join("\\t");
	return `Generate ${noteType.name} flashcards about [TOPIC]. Use tab-separated format with ${noteType.fields.length} columns:
${fieldList}

Example row:
${exampleRow}

One entry per line. No numbering or bullets.`;
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Returns an AI prompt string tailored to the given NoteType.
 *
 * Builtin types get curated prompts.
 * Custom types get a generic N-field tab-separated prompt.
 */
export function generateImportPrompt(noteType: NoteType): string {
	switch (noteType.id) {
		case BUILTIN_BASIC_ID:
			return BASIC_PROMPT(noteType.fields);
		case BUILTIN_BASIC_REVERSED_ID:
			return BASIC_REVERSED_PROMPT(noteType.fields);
		case BUILTIN_CLOZE_ID:
			return CLOZE_PROMPT(noteType.fields);
		default:
			if (noteType.type === 1) {
				return CLOZE_PROMPT(noteType.fields);
			}
			if (noteType.fields.length === 2) {
				return BASIC_PROMPT(noteType.fields);
			}
			return buildNFieldPrompt(noteType);
	}
}
