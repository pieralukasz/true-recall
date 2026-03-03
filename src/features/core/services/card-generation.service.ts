/**
 * Card Generation Service
 *
 * Given a note and its note type, determines which cards to generate.
 * Handles standard (1 card per template), reversed (2 cards), cloze (1 per index),
 * and image-occlusion (1 per region) note types.
 */

import { extractClozeIndices } from "@features/study/services/flashcard/cloze-parser.service";
import type { Note, NoteType } from "@shared/types/note.types";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "@shared/types/note.types";
import { renderTemplate, fieldIsEmpty } from "./template-engine";

export interface GeneratedCard {
	id: string;
	noteId: string;
	templateOrd: number;
	sourceUid?: string;
}

export interface EmptyCardInfo {
	templateOrd: number;
	templateName: string;
}

/**
 * Generate cards for a note based on its note type.
 * Skips template ordinals that already exist (for incremental generation).
 */
export function generateCardsForNote(
	note: Note,
	noteType: NoteType,
	existingTemplateOrds?: number[],
): GeneratedCard[] {
	const existing = new Set(existingTemplateOrds ?? []);

	let ords: number[];

	if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
		ords = getImageOcclusionOrds(note);
	} else if (noteType.type === 1) {
		ords = getClozeOrds(note, noteType);
	} else {
		ords = noteType.templates.map((t) => t.ordinal);
	}

	return ords
		.filter((ord) => !existing.has(ord))
		.map((ord) => ({
			id: crypto.randomUUID(),
			noteId: note.id,
			templateOrd: ord,
			sourceUid: note.sourceUid,
		}));
}

function getClozeOrds(note: Note, noteType: NoteType): number[] {
	// Find the first cloze field in templates
	for (const tmpl of noteType.templates) {
		const clozeMatch = tmpl.qfmt.match(/\{\{\s*cloze:(\w+)\s*\}\}/);
		if (clozeMatch) {
			const fieldName = clozeMatch[1]!;
			const fieldValue = note.fields[fieldName] ?? "";
			const indices = extractClozeIndices(fieldValue);
			// Anki ensure_not_empty: at least 1 card
			if (indices.length === 0) return [0];
			return indices;
		}
	}
	// No cloze template found — generate 1 card
	return [0];
}

function getImageOcclusionOrds(note: Note): number[] {
	const regionsStr = note.fields["Regions"] ?? "[]";
	try {
		const regions = JSON.parse(regionsStr) as unknown[];
		if (regions.length === 0) return [0];
		return regions.map((_, i) => i);
	} catch {
		return [0];
	}
}

/**
 * Detect which templates would produce empty front-side cards for the given note.
 * Returns info about templates whose rendered qfmt is empty.
 */
export function detectEmptyCards(
	note: Note,
	noteType: NoteType,
): EmptyCardInfo[] {
	const empty: EmptyCardInfo[] = [];

	for (const tmpl of noteType.templates) {
		const rendered = renderTemplate(tmpl.qfmt, {
			fields: note.fields,
			clozeIndex: tmpl.ordinal,
		});

		if (fieldIsEmpty(rendered)) {
			empty.push({
				templateOrd: tmpl.ordinal,
				templateName: tmpl.name,
			});
		}
	}

	return empty;
}
