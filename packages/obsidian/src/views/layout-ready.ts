import type { Workspace } from "obsidian";

interface RunWhenLayoutReadyOptions {
	/** Checked when a deferred run fires, so a closed view is skipped. */
	isAttached: () => boolean;
	run: () => void | Promise<void>;
}

/**
 * Runs `run` (awaited) when the workspace layout is ready; during startup
 * restore it defers to `onLayoutReady` instead. Enrichment data (frontmatter
 * index, hierarchy graph) only exists after layout-ready, so queues and
 * aggregations built earlier come out silently empty.
 */
export async function runWhenLayoutReady(
	workspace: Workspace,
	{ isAttached, run }: RunWhenLayoutReadyOptions,
): Promise<void> {
	if (workspace.layoutReady) {
		await run();
		return;
	}
	workspace.onLayoutReady(() => {
		if (!isAttached()) return;
		void run();
	});
}
