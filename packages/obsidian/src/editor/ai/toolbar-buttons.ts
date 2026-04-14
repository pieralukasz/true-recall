interface ToolbarButtonDef {
	id: string;
	label: string;
	title: string;
	editorOnly: boolean;
}

export const BUILTIN_BUTTONS: ToolbarButtonDef[] = [
	{
		id: "flashcards",
		label: "AI Flashcards",
		title: "Generate flashcard(s) with AI",
		editorOnly: false,
	},
	{
		id: "vocab",
		label: "Vocab",
		title: "Generate vocabulary flashcards using active language preset",
		editorOnly: false,
	},
	{
		id: "io",
		label: "Image Occlusion",
		title: "Create image occlusion card",
		editorOnly: true,
	},
	{
		id: "edit",
		label: "Edit",
		title: "Open in flashcard editor",
		editorOnly: false,
	},
	{
		id: "quick-add",
		label: "Quick+",
		title: "Quick add as basic flashcard",
		editorOnly: false,
	},
	{
		id: "highlight",
		label: "Highlight",
		title: "Wrap selection with ==highlight==",
		editorOnly: true,
	},
	{
		id: "copy",
		label: "Copy",
		title: "Copy selection",
		editorOnly: false,
	},
	{
		id: "new-note",
		label: "Note+",
		title: "Create a new note from selection",
		editorOnly: false,
	},
	{
		id: "append",
		label: "Append",
		title: "Append selection to current note",
		editorOnly: false,
	},
];

export function getButtonLabel(id: string): string {
	const builtin = BUILTIN_BUTTONS.find((b) => b.id === id);
	return builtin?.label ?? id;
}

export function isBuiltinButton(id: string): boolean {
	return BUILTIN_BUTTONS.some((b) => b.id === id);
}
