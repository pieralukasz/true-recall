import { App, Platform, WorkspaceLeaf } from "obsidian";

export interface ViewActivationOptions {
	useMainArea?: boolean;
	state?: Record<string, unknown>;
	skipReveal?: boolean;
}

/** Handles mobile vs desktop differences automatically */
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
		void workspace.revealLeaf(leaf);
	}

	return leaf;
}

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
	void workspace.revealLeaf(leaf);

	return leaf;
}

/** Only allows one review session at a time */
export async function activateReviewView(
	app: App,
	viewType: string,
	reviewMode: "fullscreen" | "panel",
	state?: Record<string, unknown>
): Promise<WorkspaceLeaf | null> {
	const { workspace } = app;

	// Check if review session already exists - only allow one at a time
	const existingLeaf = workspace.getLeavesOfType(viewType)[0];
	if (existingLeaf) {
		void workspace.revealLeaf(existingLeaf);
		return existingLeaf;
	}

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
		void workspace.revealLeaf(rightLeaf);
		return rightLeaf;
	}

	return null;
}

export function closeAllViews(app: App, viewType: string): void {
	const leaves = app.workspace.getLeavesOfType(viewType);
	for (const leaf of leaves) {
		leaf.detach();
	}
}

export function viewExists(app: App, viewType: string): boolean {
	return app.workspace.getLeavesOfType(viewType).length > 0;
}

export function getView(app: App, viewType: string): WorkspaceLeaf | null {
	return app.workspace.getLeavesOfType(viewType)[0] ?? null;
}
