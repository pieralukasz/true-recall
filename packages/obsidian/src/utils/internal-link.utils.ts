/**
 * Internal Link Handler Utility
 * Provides consistent handling of Obsidian wiki links [[link]] in rendered markdown
 */
import type { App } from "obsidian";

interface InternalLinkHandlerOptions {
	/** Obsidian app instance */
	app: App;
	/** File path for link resolution context */
	filePath: string;
	/** Optional callback when Ctrl/Cmd+Click is used (e.g., for edit mode) */
	onCtrlClick?: () => void;
}

/**
 * Setup click handler for internal links (wiki links) in an element
 * Uses capture phase to intercept before Obsidian's default handlers
 *
 * @param element - The container element containing rendered markdown
 * @param options - Handler configuration
 * @returns Cleanup function to remove the event listener
 */
function setupInternalLinkHandler(
	element: HTMLElement,
	options: InternalLinkHandlerOptions,
): () => void {
	const { app, filePath, onCtrlClick } = options;

	const handler = (e: MouseEvent) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;

		const linkEl = target.closest("a.internal-link");
		if (!linkEl) return;

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		const href = linkEl.getAttribute("data-href");
		if (!href) return;

		// Check for Ctrl/Cmd+Click (edit mode trigger)
		if ((e.metaKey || e.ctrlKey) && onCtrlClick) {
			onCtrlClick();
			return;
		}

		// Open link in existing tab if available
		void app.workspace.openLinkText(href, filePath, false);
	};

	// Use capture phase to intercept before Obsidian's handlers
	element.addEventListener("click", handler, true);

	return () => element.removeEventListener("click", handler, true);
}
