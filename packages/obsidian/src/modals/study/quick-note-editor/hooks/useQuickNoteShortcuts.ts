import { useEffect, useRef } from "preact/hooks";

import type { QuickNoteEditor } from "./useQuickNoteEditor";
export function useQuickNoteShortcuts(
	{
		rootRef,
		userCommentInputRef,
	}: Pick<QuickNoteEditor, "rootRef" | "userCommentInputRef">,
	handleSave: () => Promise<boolean>,
	handleUndoLastCreate: () => boolean,
) {
	const handleUndoLastCreateRef = useRef(handleUndoLastCreate);
	handleUndoLastCreateRef.current = handleUndoLastCreate;

	// Cmd/Ctrl+Enter saves from anywhere in the modal (not just CM fields).
	// CodeMirror and textarea fields commit their live value before saving, so
	// the editor's debounced change callback cannot submit stale content.
	const handleSaveRef = useRef(handleSave);
	handleSaveRef.current = handleSave;

	useEffect(() => {
		// Bind to the owning document so the shortcut works inside a popout
		// window (containerEl.win !== window). Falling back to `document`
		// covers the modal context where the listener attaches before the
		// element is in the DOM.
		const doc = rootRef.current?.ownerDocument ?? activeDocument;
		const onKeyDown = (e: KeyboardEvent) => {
			if (
				!e.shiftKey &&
				(e.metaKey || e.ctrlKey) &&
				e.key.toLowerCase() === "z" &&
				handleUndoLastCreateRef.current()
			) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				e.stopPropagation();
				userCommentInputRef.current?.focus();
				return;
			}
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				const target = e.target as HTMLElement | null;
				if (
					target?.closest?.(
						".true-recall-add-field, .true-recall-add-field-row textarea",
					)
				) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
				void handleSaveRef.current();
			}
		};
		doc.addEventListener("keydown", onKeyDown, true);
		return () => {
			doc.removeEventListener("keydown", onKeyDown, true);
		};
	}, []);
}
