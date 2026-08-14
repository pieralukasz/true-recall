export type PanelKeyboardMode = "list" | "detail" | "selection";

export type PanelKeyboardAction =
	| "focus-search"
	| "add-card"
	| "select-visible"
	| "close"
	| "edit-card"
	| "previous-card"
	| "next-card"
	| "show-shortcuts"
	| null;

interface PanelKeyboardInput {
	key: string;
	metaKey?: boolean;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	mode: PanelKeyboardMode;
	isEditingText: boolean;
}

export function resolvePanelKeyboardAction({
	key,
	metaKey = false,
	ctrlKey = false,
	shiftKey = false,
	mode,
	isEditingText,
}: PanelKeyboardInput): PanelKeyboardAction {
	const modifier = metaKey || ctrlKey;
	if (modifier && key.toLocaleLowerCase() === "f") return "focus-search";
	if (modifier && key.toLocaleLowerCase() === "a" && !isEditingText) {
		return "select-visible";
	}
	if (key === "Escape" && !isEditingText) return "close";
	if (isEditingText || modifier) return null;

	const lower = key.toLocaleLowerCase();
	if (key === "/") return "focus-search";
	if (key === "?" || (shiftKey && key === "/")) return "show-shortcuts";
	if (lower === "n" && mode === "list") return "add-card";
	if (lower === "e" && mode === "detail") return "edit-card";
	if ((lower === "k" || key === "ArrowUp") && mode === "detail") {
		return "previous-card";
	}
	if ((lower === "j" || key === "ArrowDown") && mode === "detail") {
		return "next-card";
	}
	return null;
}
