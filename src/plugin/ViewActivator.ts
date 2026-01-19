/**
 * ViewActivator - Consolidated view activation utility
 * Replaces 6+ duplicate activateXxxView methods in main.ts
 */
import { App, Platform, WorkspaceLeaf } from "obsidian";

export interface ViewActivationOptions {
	/** Force open in main area instead of sidebar */
	useMainArea?: boolean;
	/** Initial state to pass to the view */
	state?: Record<string, unknown>;
	/** Skip revealing the leaf after activation */
	skipReveal?: boolean;
}

/**
 * Activate a view by type, creating it if it doesn't exist
 * Handles mobile vs desktop differences automatically
 *
 * @param app - The Obsidian app instance
 * @param viewType - The view type constant (e.g., VIEW_TYPE_REVIEW)
 * @param options - Optional configuration
 * @returns The activated leaf, or null if activation failed
 */
export async function activateView(
	app: App,
	viewType: string,
	options: ViewActivationOptions = {}
): Promise<WorkspaceLeaf | null> {
	const { workspace } = app;
	const { useMainArea = false, state, skipReveal = false } = options;

	// Check if view already exists
	let leaf = workspace.getLeavesOfType(viewType)[0];

	if (!leaf) {
		// Create new leaf based on platform and options
		if (Platform.isMobile || useMainArea) {
			// On mobile or when explicitly requested, open in main area
			leaf = workspace.getLeaf(true);
		} else {
			// Desktop: use right sidebar by default
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
			} else {
				// Fallback to main area if right leaf unavailable
				leaf = workspace.getLeaf(true);
			}
		}

		// Set view state
		await leaf.setViewState({
			type: viewType,
			active: true,
			state,
		});
	}

	// Reveal and focus the leaf
	if (leaf && !skipReveal) {
		workspace.revealLeaf(leaf);
	}

	return leaf;
}

/**
 * Activate a view in the main content area (fullscreen mode)
 * Used for review views when fullscreen mode is enabled
 *
 * @param app - The Obsidian app instance
 * @param viewType - The view type constant
 * @param state - Optional initial state
 * @returns The activated leaf
 */
export async function activateMainAreaView(
	app: App,
	viewType: string,
	state?: Record<string, unknown>
): Promise<WorkspaceLeaf> {
	const { workspace } = app;

	const leaf = workspace.getLeaf(true);
	await leaf.setViewState({
		type: viewType,
		active: true,
		state,
	});
	workspace.revealLeaf(leaf);

	return leaf;
}

/**
 * Activate a view based on review mode setting
 * Handles fullscreen vs panel (sidebar) mode
 *
 * @param app - The Obsidian app instance
 * @param viewType - The view type constant
 * @param reviewMode - "fullscreen" or "panel"
 * @param state - Optional initial state
 * @returns The activated leaf
 */
export async function activateReviewView(
	app: App,
	viewType: string,
	reviewMode: "fullscreen" | "panel",
	state?: Record<string, unknown>
): Promise<WorkspaceLeaf | null> {
	const { workspace } = app;

	// Force fullscreen on mobile or when configured
	if (Platform.isMobile || reviewMode === "fullscreen") {
		return activateMainAreaView(app, viewType, state);
	}

	// Desktop panel mode (right sidebar)
	const rightLeaf = workspace.getRightLeaf(false);
	if (rightLeaf) {
		await rightLeaf.setViewState({
			type: viewType,
			active: true,
			state,
		});
		workspace.revealLeaf(rightLeaf);
		return rightLeaf;
	}

	return null;
}

/**
 * Close all leaves of a specific view type
 *
 * @param app - The Obsidian app instance
 * @param viewType - The view type to close
 */
export function closeAllViews(app: App, viewType: string): void {
	const leaves = app.workspace.getLeavesOfType(viewType);
	for (const leaf of leaves) {
		leaf.detach();
	}
}

/**
 * Check if a view of the given type exists
 *
 * @param app - The Obsidian app instance
 * @param viewType - The view type to check
 * @returns true if at least one leaf of this type exists
 */
export function viewExists(app: App, viewType: string): boolean {
	return app.workspace.getLeavesOfType(viewType).length > 0;
}

/**
 * Get the first leaf of a specific view type
 *
 * @param app - The Obsidian app instance
 * @param viewType - The view type to find
 * @returns The leaf if found, null otherwise
 */
export function getView(app: App, viewType: string): WorkspaceLeaf | null {
	return app.workspace.getLeavesOfType(viewType)[0] ?? null;
}
