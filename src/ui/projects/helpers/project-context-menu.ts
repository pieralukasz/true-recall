import { Menu } from "obsidian";
import type { ProjectInfo } from "../../../types";

export type ProjectContextAction =
	| "review"
	| "custom-study"
	| "add-notes"
	| "create-sub-project"
	| "open-note"
	| "delete";

export interface ProjectContextMenuOptions {
	project: ProjectInfo;
	hasCards: boolean;
	onAction: (action: ProjectContextAction) => void;
}

export function showProjectContextMenu(
	event: MouseEvent | { x: number; y: number },
	options: ProjectContextMenuOptions
): void {
	const { project, hasCards, onAction } = options;
	const menu = new Menu();

	if (hasCards) {
		menu.addItem((item) => {
			item.setTitle("Start review")
				.setIcon("play")
				.onClick(() => onAction("review"));
		});

		menu.addItem((item) => {
			item.setTitle("Custom study")
				.setIcon("sliders-horizontal")
				.onClick(() => onAction("custom-study"));
		});

		menu.addSeparator();
	}

	menu.addItem((item) => {
		item.setTitle("Add notes")
			.setIcon("plus")
			.onClick(() => onAction("add-notes"));
	});

	menu.addItem((item) => {
		item.setTitle("Create sub-project")
			.setIcon("folder-plus")
			.onClick(() => onAction("create-sub-project"));
	});

	menu.addItem((item) => {
		item.setTitle(`Open "${project.name}"`)
			.setIcon("file-text")
			.onClick(() => onAction("open-note"));
	});

	menu.addSeparator();

	menu.addItem((item) => {
		item.setTitle("Delete project")
			.setIcon("trash-2")
			.onClick(() => onAction("delete"));
	});

	if ("x" in event && !("target" in event)) {
		menu.showAtPosition(event as { x: number; y: number });
	} else {
		menu.showAtMouseEvent(event);
	}
}
