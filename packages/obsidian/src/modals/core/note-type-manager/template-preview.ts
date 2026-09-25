/**
 * Pure helpers behind TemplatePreview: sample field values and the note type
 * Styling applied to the preview.
 */

import {
	ankiCardNumber,
	type ScopedNoteTypeCss,
	scopeNoteTypeCss,
} from "@true-recall/obsidian/features/study/ui/review/helpers/note-type-css";

/** Placeholder values shown for each field in the preview */
export function buildSampleFields(
	fields: readonly string[],
	noteTypeType: 0 | 1,
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const f of fields) {
		result[f] = noteTypeType === 1 ? `{{c1::sample ${f} text}}` : `(${f})`;
	}
	return result;
}

/**
 * Scope id for preview CSS. Prefixed so CSS still being edited never reaches
 * cards of the same note type rendered elsewhere (review, Card Browser):
 * `<style>` rules apply to the whole document.
 */
export function previewScopeId(noteTypeId: string | undefined): string {
	return `preview-${noteTypeId ?? "draft"}`;
}

/**
 * The note type CSS for a template preview, or null when there is none.
 * The preview renders cloze number 1, so cloze types map to `.card1`.
 */
export function previewNoteTypeCss(
	css: string | undefined,
	noteTypeId: string | undefined,
	templateOrdinal: number,
	noteTypeType: 0 | 1,
): ScopedNoteTypeCss | null {
	if (!css?.trim()) return null;
	const isCloze = noteTypeType === 1;
	const cardNumber = ankiCardNumber(isCloze ? 1 : templateOrdinal, isCloze);
	const scoped = scopeNoteTypeCss(css, previewScopeId(noteTypeId), cardNumber);
	return scoped.css ? scoped : null;
}
