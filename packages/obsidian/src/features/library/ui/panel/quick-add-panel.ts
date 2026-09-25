import type { QuickNoteEditorMode } from "@true-recall/obsidian/modals/study/quick-note-editor/types";

export function createQuickAddPanelMode(
	sourceUid: string | undefined,
): QuickNoteEditorMode {
	return { mode: "add", sourceUid };
}

export function needsQuickAddDiscardConfirmation(isDirty: boolean): boolean {
	return isDirty;
}
