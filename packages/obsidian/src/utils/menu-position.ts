import type { Menu } from "obsidian";

/**
 * Opens a menu where the user triggered it. `Clickable` also fires `onClick`
 * for Enter/Space, and a keyboard event has no pointer position, so the menu
 * then opens under the focused control instead of the window's top-left corner.
 */
export function showMenuForEvent(
	menu: Menu,
	event: MouseEvent | KeyboardEvent,
): void {
	if (event instanceof MouseEvent) {
		menu.showAtMouseEvent(event);
		return;
	}
	const target = event.currentTarget ?? event.target;
	if (target instanceof HTMLElement) {
		const rect = target.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
		return;
	}
	menu.showAtPosition({ x: 0, y: 0 });
}
