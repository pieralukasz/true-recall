/**
 * What the Card Types Editor preview shows: the saved note type, with the
 * text currently typed in the open editor laid over it. Edits are saved on
 * blur, so without the overlay the preview would lag one blur behind.
 */

import type { CardTemplate } from "@true-recall/core/types/note.types";

import type { EditorTab } from "./EditorTabs";

/** Unsaved text of one editor, tagged with the editor it came from */
export interface LiveEdit {
	key: string;
	value: string;
}

export function liveEditKey(
	noteTypeId: string,
	templateIndex: number,
	tab: EditorTab,
): string {
	return `${noteTypeId}:${templateIndex}:${tab}`;
}

export interface LivePreviewSource {
	template: CardTemplate | null;
	css: string;
}

export function resolveLivePreview(
	noteType: { id: string; css?: string; templates: readonly CardTemplate[] },
	templateIndex: number,
	tab: EditorTab,
	liveEdit: LiveEdit | null,
): LivePreviewSource {
	const saved = noteType.templates[templateIndex] ?? null;
	const css = noteType.css ?? "";
	// An edit from another editor (tab or template switched) is stale
	if (
		!liveEdit ||
		liveEdit.key !== liveEditKey(noteType.id, templateIndex, tab)
	) {
		return { template: saved, css };
	}
	if (tab === "styling") return { template: saved, css: liveEdit.value };
	if (!saved) return { template: null, css };
	return {
		template: {
			...saved,
			[tab === "front" ? "qfmt" : "afmt"]: liveEdit.value,
		},
		css,
	};
}
