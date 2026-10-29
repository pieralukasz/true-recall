import { FLASHCARD_CONFIG } from "@true-recall/core/constants";

import type { QuickNoteEditorMode } from "../types";

export function initialAlwaysTypeIn(mode: QuickNoteEditorMode): boolean {
	return (
		mode.mode === "edit" &&
		(mode.note.tags ?? []).includes(FLASHCARD_CONFIG.alwaysTypeInTag)
	);
}
export function canSaveQuickNote(
	fields: Record<string, string>,
	fieldNames: readonly string[],
): boolean {
	const primary = fieldNames[0];
	return !!primary && (fields[primary] ?? "").trim().length > 0;
}
export function isQuickNoteDirty(
	mode: QuickNoteEditorMode,
	fields: Record<string, string>,
	comment: string,
	alwaysTypeIn = false,
): boolean {
	if (mode.mode === "edit") {
		const initial = mode.note.fields;
		return (
			comment !== (mode.note.userComment ?? "") ||
			alwaysTypeIn !== initialAlwaysTypeIn(mode) ||
			[...new Set([...Object.keys(initial), ...Object.keys(fields)])].some(
				(name) => fields[name] !== initial[name],
			)
		);
	}
	return (
		comment !== "" ||
		Object.values(fields).some((value) => value.trim().length > 0)
	);
}
