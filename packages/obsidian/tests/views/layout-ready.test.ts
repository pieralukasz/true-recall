import type { Workspace } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { runWhenLayoutReady } from "@true-recall/obsidian/views/layout-ready";

function createFakeWorkspace(layoutReady: boolean) {
	const layoutReadyCallbacks: Array<() => void> = [];
	const workspace = {
		layoutReady,
		onLayoutReady: (callback: () => void) => {
			layoutReadyCallbacks.push(callback);
		},
	} as unknown as Workspace;

	return {
		workspace,
		fireLayoutReady: () => {
			for (const callback of layoutReadyCallbacks.splice(0)) callback();
		},
	};
}

describe("runWhenLayoutReady", () => {
	it("runs and awaits immediately when the layout is ready", async () => {
		const { workspace } = createFakeWorkspace(true);
		let completed = false;
		const run = vi.fn(async () => {
			await Promise.resolve();
			completed = true;
		});

		await runWhenLayoutReady(workspace, { isAttached: () => true, run });

		expect(run).toHaveBeenCalledTimes(1);
		expect(completed).toBe(true);
	});

	it("defers the run until the layout becomes ready", async () => {
		const fake = createFakeWorkspace(false);
		const run = vi.fn();

		await runWhenLayoutReady(fake.workspace, { isAttached: () => true, run });
		expect(run).not.toHaveBeenCalled();

		fake.fireLayoutReady();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("skips a deferred run when the view is no longer attached", async () => {
		const fake = createFakeWorkspace(false);
		const run = vi.fn();

		await runWhenLayoutReady(fake.workspace, { isAttached: () => false, run });
		fake.fireLayoutReady();

		expect(run).not.toHaveBeenCalled();
	});
});
