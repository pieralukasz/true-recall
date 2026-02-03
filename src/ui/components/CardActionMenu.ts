import { Menu } from "obsidian";

export interface CardActionMenuOptions {
	onEdit?: () => void;
	onDelete?: () => void;
	onCopy?: () => void;
	onMove?: () => void;
	onSelect?: () => void;
	isSelectionMode?: boolean;
	prependItems?: CardMenuItem[];
	appendItems?: CardMenuItem[];
}

export interface CardMenuItem {
	title: string;
	icon?: string;
	onClick: () => void;
	separator?: boolean;
}

export function showCardActionMenu(
	event: MouseEvent,
	options: CardActionMenuOptions
): void {
	const menu = new Menu();

	// Prepend items
	if (options.prependItems) {
		for (const item of options.prependItems) {
			if (item.separator) {
				menu.addSeparator();
			}
			menu.addItem((menuItem) => {
				menuItem.setTitle(item.title);
				if (item.icon) {
					menuItem.setIcon(item.icon);
				}
				menuItem.onClick(item.onClick);
			});
		}
	}

	// Edit
	if (options.onEdit) {
		menu.addItem((item) => {
			item.setTitle("Edit")
				.setIcon("pencil")
				.onClick(() => options.onEdit?.());
		});
	}

	// Copy
	if (options.onCopy) {
		menu.addItem((item) => {
			item.setTitle("Copy")
				.setIcon("copy")
				.onClick(() => options.onCopy?.());
		});
	}

	// Move
	if (options.onMove) {
		menu.addItem((item) => {
			item.setTitle("Move")
				.setIcon("folder-input")
				.onClick(() => options.onMove?.());
		});
	}

	// Delete (with separator before)
	if (options.onDelete) {
		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle("Delete")
				.setIcon("trash-2")
				.onClick(() => options.onDelete?.());
		});
	}

	// Select (if not in selection mode)
	if (options.onSelect && !options.isSelectionMode) {
		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle("Select")
				.setIcon("check-square")
				.onClick(() => options.onSelect?.());
		});
	}

	// Append items
	if (options.appendItems) {
		for (const item of options.appendItems) {
			if (item.separator) {
				menu.addSeparator();
			}
			menu.addItem((menuItem) => {
				menuItem.setTitle(item.title);
				if (item.icon) {
					menuItem.setIcon(item.icon);
				}
				menuItem.onClick(item.onClick);
			});
		}
	}

	menu.showAtMouseEvent(event);
}
