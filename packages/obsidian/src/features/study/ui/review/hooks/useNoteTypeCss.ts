import { useMemo } from "preact/hooks";

import {
	ankiCardNumber,
	type ScopedNoteTypeCss,
	scopeNoteTypeCss,
} from "@true-recall/obsidian/features/study/ui/review/helpers/note-type-css";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

/**
 * A card's note type Styling (Anki-compatible CSS), scoped to the elements
 * that get `className`. Callers render `css` in a `<style>` child of the card,
 * so the rules live and die with the rendered card instead of being attached
 * to the document head.
 */
export function useNoteTypeCss(
	noteTypeId: string | undefined,
	templateOrd: number | undefined,
	isCloze: boolean,
): ScopedNoteTypeCss | null {
	const plugin = usePlugin();
	const cardNumber = ankiCardNumber(templateOrd, isCloze);
	let css = "";
	try {
		css = noteTypeId
			? (plugin.cardStore.noteTypes.getById(noteTypeId)?.css ?? "")
			: "";
	} catch {
		// Store not ready: render without note type styling
	}
	return useMemo(
		() =>
			noteTypeId && css.trim()
				? scopeNoteTypeCss(css, noteTypeId, cardNumber)
				: null,
		[css, noteTypeId, cardNumber],
	);
}
