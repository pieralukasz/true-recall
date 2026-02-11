import { Menu } from "obsidian";

export type NoteContextAction = "open" | "remove-from-project";

export interface NoteContextMenuOptions {
	noteName: string;
	onAction: (action: NoteContextAction) => void;
}

export function showNoteContextMenu(
	position: { x: number; y: number },
	options: NoteContextMenuOptions
): void {
	const { noteName, onAction } = options;
	const menu = new Menu();

	menu.addItem((item) => {
		item.setTitle(`Open "${noteName}"`)
			.setIcon("file-text")
			.onClick(() => onAction("open"));
	});

	menu.addSeparator();

	menu.addItem((item) => {
		item.setTitle("Remove from project")
			.setIcon("x")
			.onClick(() => onAction("remove-from-project"));
	});

	menu.showAtPosition(position);
}
