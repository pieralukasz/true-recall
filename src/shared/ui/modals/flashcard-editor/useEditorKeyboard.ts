import { useCallback } from "preact/hooks";
import type { ToolbarButton } from "@features/library/ui/editor/edit-toolbar.utils";
import { executeToolbarAction } from "@shared/ui/modals/flashcard-editor/EditorField";

export function useEditorKeyboard(opts: {
	isFormValid: boolean;
	handleSubmit: () => void;
	onClose: () => void;
	onShowKeyboardShortcuts: () => void;
	toolbarButtons: ToolbarButton[];
	handleMediaPick: () => Promise<void>;
}) {
	const {
		isFormValid,
		handleSubmit,
		onClose,
		onShowKeyboardShortcuts,
		toolbarButtons,
		handleMediaPick,
	} = opts;

	const findFocusedTextarea = useCallback((): HTMLTextAreaElement | null => {
		const active = document.activeElement;
		if (
			active instanceof HTMLTextAreaElement &&
			active.hasAttribute("data-field")
		) {
			return active;
		}
		return null;
	}, []);

	const executeButtonOnFocused = useCallback(
		(buttonId: string) => {
			const textarea = findFocusedTextarea();
			if (!textarea) return;

			const btn = toolbarButtons.find((b) => b.id === buttonId);
			if (btn) {
				executeToolbarAction(btn.action, textarea);
			}
		},
		[toolbarButtons, findFocusedTextarea],
	);

	const handleContainerKeyDown = useCallback(
		(e: KeyboardEvent) => {
			const isMod = e.metaKey || e.ctrlKey;

			if (isMod && e.key === "Enter") {
				e.preventDefault();
				if (isFormValid) handleSubmit();
				return;
			}
			if (e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement)) {
				e.preventDefault();
				onClose();
				return;
			}
			if (isMod && e.key === "/") {
				e.preventDefault();
				onShowKeyboardShortcuts();
				return;
			}

			if (!findFocusedTextarea()) return;

			if (isMod && e.key === "b") {
				e.preventDefault();
				executeButtonOnFocused("bold");
				return;
			}
			if (isMod && e.key === "i") {
				e.preventDefault();
				executeButtonOnFocused("italic");
				return;
			}
			if (isMod && e.key === "k") {
				e.preventDefault();
				executeButtonOnFocused("wiki");
				return;
			}
			if (isMod && e.key === "m") {
				e.preventDefault();
				executeButtonOnFocused("math");
				return;
			}
			if (isMod && e.key === "l") {
				e.preventDefault();
				executeButtonOnFocused("list");
				return;
			}
			if (isMod && e.shiftKey && e.key === "i") {
				e.preventDefault();
				void handleMediaPick();
				return;
			}
			if (isMod && e.shiftKey && e.key.toLowerCase() === "c") {
				e.preventDefault();
				executeButtonOnFocused("codeblock");
				return;
			}
		},
		[
			isFormValid,
			handleSubmit,
			onClose,
			onShowKeyboardShortcuts,
			findFocusedTextarea,
			executeButtonOnFocused,
			handleMediaPick,
		],
	);

	return handleContainerKeyDown;
}
