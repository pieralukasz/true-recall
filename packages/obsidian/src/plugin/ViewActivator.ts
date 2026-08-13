import { type App, Platform, type WorkspaceLeaf } from "obsidian";

interface ViewActivationOptions {
	useMainArea?: boolean;
	state?: Record<string, unknown>;
	skipReveal?: boolean;
}

const pendingReviewActivations = new WeakMap<
	App,
	Map<string, Promise<WorkspaceLeaf | null>>
>();

function canonicalizeViewState(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalizeViewState);
	}
	if (!value || typeof value !== "object") return value;

	const normalized: Record<string, unknown> = {};
	for (const key of Object.keys(value).sort()) {
		if (key === "topUp") continue;
		const child = (value as Record<string, unknown>)[key];
		if (child !== undefined) {
			normalized[key] = canonicalizeViewState(child);
		}
	}
	return normalized;
}

function getViewStateKey(state?: Record<string, unknown>): string {
	if (typeof state?.sessionKey === "string") {
		return `session:${state.sessionKey}`;
	}
	return JSON.stringify(canonicalizeViewState(state ?? {}));
}

/** Reveals an already-open view representing the same review session. */
export function revealReviewView(
	app: App,
	viewType: string,
	state?: Record<string, unknown>,
): WorkspaceLeaf | null {
	const stateKey = getViewStateKey(state);
	const leaf = app.workspace
		.getLeavesOfType(viewType)
		.find(
			(candidate) =>
				getViewStateKey(candidate.getViewState().state) === stateKey,
		);

	if (!leaf) return null;
	void app.workspace.revealLeaf(leaf);
	return leaf;
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

async function createReviewView(
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
	if (!rightLeaf) return null;

	await rightLeaf.setViewState({
		type: viewType,
		active: true,
		state,
	});
	void workspace.revealLeaf(rightLeaf);
	return rightLeaf;
}

export async function activateReviewView(
	app: App,
	viewType: string,
	reviewMode: "fullscreen" | "panel",
	state?: Record<string, unknown>,
): Promise<WorkspaceLeaf | null> {
	const existingLeaf = revealReviewView(app, viewType, state);
	if (existingLeaf) return existingLeaf;

	let appActivations = pendingReviewActivations.get(app);
	if (!appActivations) {
		appActivations = new Map();
		pendingReviewActivations.set(app, appActivations);
	}

	const activationKey = `${viewType}:${getViewStateKey(state)}`;
	const pending = appActivations.get(activationKey);
	if (pending) return pending;

	const activation = createReviewView(app, viewType, reviewMode, state);
	appActivations.set(activationKey, activation);

	try {
		return await activation;
	} finally {
		appActivations.delete(activationKey);
	}
}

export function getView(app: App, viewType: string): WorkspaceLeaf | null {
	return app.workspace.getLeavesOfType(viewType)[0] ?? null;
}
