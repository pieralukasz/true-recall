import { Menu } from "obsidian";
import { useCallback, useRef } from "preact/hooks";
/**
 * Returns a stable click handler that shows an Obsidian context menu
 * built from the latest items. Uses a ref internally so the handler
 * identity never changes while always reading fresh menu definitions.
 */
export function useContextMenu(items) {
    const itemsRef = useRef(items);
    itemsRef.current = items;
    return useCallback((e) => {
        e.stopPropagation();
        const menu = new Menu();
        for (const entry of itemsRef.current) {
            if (entry === "separator") {
                menu.addSeparator();
            }
            else {
                menu.addItem((mi) => {
                    mi.setTitle(entry.title).onClick(entry.onClick);
                    if (entry.icon)
                        mi.setIcon(entry.icon);
                });
            }
        }
        menu.showAtMouseEvent(e);
    }, []);
}
