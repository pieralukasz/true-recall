import { type ReadonlySignal, signal } from "@preact/signals";
import type { ItemView } from "obsidian";

/**
 * Reactive visibility of an ItemView's content. False while the leaf sits in
 * a background tab, so Preact apps can pause expensive recomputation until
 * the view is revealed (see useGatedComputed).
 */
export function createViewVisibility(view: ItemView): ReadonlySignal<boolean> {
	const isVisible = signal(view.containerEl.isShown());
	const update = () => {
		isVisible.value = view.containerEl.isShown();
	};
	view.registerEvent(view.app.workspace.on("layout-change", update));
	view.registerEvent(view.app.workspace.on("active-leaf-change", update));
	// During workspace restore the signal seeds before the container is
	// attached, and neither event above is guaranteed to fire again once it
	// becomes visible — re-check when the layout settles (immediate if ready).
	view.app.workspace.onLayoutReady(update);
	return isVisible;
}
