import { Menu } from "obsidian";
import { useCallback, useRef } from "preact/hooks";

export interface MenuAction {
	title: string;
	icon?: string;
	onClick: () => void;
}

export interface MenuSubmenu {
	title: string;
	icon?: string;
	children: MenuItem[];
}

export type MenuItem = MenuAction | MenuSubmenu | "separator";

function isSubmenu(item: MenuAction | MenuSubmenu): item is MenuSubmenu {
	return "children" in item;
}

function buildMenu(menu: Menu, items: MenuItem[]): void {
	for (const entry of items) {
		if (entry === "separator") {
			menu.addSeparator();
		} else if (isSubmenu(entry)) {
			menu.addItem((mi) => {
				mi.setTitle(entry.title);
				if (entry.icon) mi.setIcon(entry.icon);
				const sub = (mi as unknown as { setSubmenu: () => Menu }).setSubmenu();
				buildMenu(sub, entry.children);
			});
		} else {
			menu.addItem((mi) => {
				mi.setTitle(entry.title).onClick(entry.onClick);
				if (entry.icon) mi.setIcon(entry.icon);
			});
		}
	}
}

/**
 * Returns a stable click handler that shows an Obsidian context menu
 * built from the latest items. Uses a ref internally so the handler
 * identity never changes while always reading fresh menu definitions.
 */
export function useContextMenu(items: MenuItem[]): (e: MouseEvent) => void {
	const itemsRef = useRef(items);
	itemsRef.current = items;

	return useCallback((e: MouseEvent) => {
		e.stopPropagation();
		const menu = new Menu();
		buildMenu(menu, itemsRef.current);
		menu.showAtMouseEvent(e);
	}, []);
}
