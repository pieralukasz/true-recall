import { type App, Platform, type WorkspaceLeaf } from "obsidian";

interface ViewActivationOptions {
	useMainArea?: boolean;
	state?: Record<string, unknown>;
	skipReveal?: boolean;
}

/** Handles mobile vs desktop differences automatically */
export async function activateView(
	app: App,
	viewType: string,
	options: ViewActivationOptions = {},
): Promise<WorkspaceLeaf | null> {
	const { workspace } = app;
	const { useMainArea = false, state, skipReveal = false } = options;

	let leaf = workspace.getLeavesOfType(viewType)[0];

	if (!leaf) {
		if (Platform.isMobile || useMainArea) {
			leaf = workspace.getLeaf(true);
		} else {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
			} else {
				leaf = workspace.getLeaf(true);
			}
		}

		await leaf.setViewState({
			type: viewType,
			active: true,
			state,
		});
	}

	if (leaf && !skipReveal) {
		void workspace.revealLeaf(leaf);
	}

	return leaf;
}

async function activateMainAreaView(
	app: App,
	viewType: string,
	state?: Record<string, unknown>,
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

export async function activateReviewView(
	app: App,
	viewType: string,
	reviewMode: "fullscreen" | "panel",
	state?: Record<string, unknown>,
): Promise<WorkspaceLeaf | null> {
	const { workspace } = app;

	if (Platform.isMobile || reviewMode === "fullscreen") {
		return activateMainAreaView(app, viewType, state);
	}

	const hasOpenReview = workspace.getLeavesOfType(viewType).length > 0;
	const rightLeaf = workspace.getRightLeaf(hasOpenReview);
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

export function getView(app: App, viewType: string): WorkspaceLeaf | null {
	return app.workspace.getLeavesOfType(viewType)[0] ?? null;
}
