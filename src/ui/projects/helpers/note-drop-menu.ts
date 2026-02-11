import { Menu } from "obsidian";

export type NoteDropAction = "move" | "add" | "cancel";

export interface NoteDropMenuOptions {
	noteName: string;
	targetProjectName: string;
	sourceProjectName: string | null;
}

export function showNoteDropMenu(
	position: { x: number; y: number },
	options: NoteDropMenuOptions
): Promise<NoteDropAction> {
	return new Promise((resolve) => {
		const { noteName, targetProjectName, sourceProjectName } = options;
		const menu = new Menu();
		let resolved = false;

		if (sourceProjectName) {
			menu.addItem((item) => {
				item.setTitle(`Move "${noteName}" to "${targetProjectName}"`)
					.setIcon("folder-input")
					.onClick(() => {
						resolved = true;
						resolve("move");
					});
			});
		}

		menu.addItem((item) => {
			item.setTitle(`Also add to "${targetProjectName}"`)
				.setIcon("folder-plus")
				.onClick(() => {
					resolved = true;
					resolve("add");
				});
		});

		// Resolve cancel when menu closes without selection
		// Obsidian Menu fires 'close' on dismiss
		const originalOnHide = (menu as unknown as { onHide: () => void }).onHide;
		(menu as unknown as { onHide: () => void }).onHide = () => {
			originalOnHide?.call(menu);
			if (!resolved) {
				resolve("cancel");
			}
		};

		menu.showAtPosition(position);
	});
}
