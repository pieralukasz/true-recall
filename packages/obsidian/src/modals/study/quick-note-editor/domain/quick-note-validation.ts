import type { QuickNoteEditorMode } from "../types";
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
): boolean {
	if (mode.mode === "edit") {
		const initial = mode.note.fields;
		return (
			comment !== (mode.note.userComment ?? "") ||
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
