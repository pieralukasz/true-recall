import type { App, WorkspaceLeaf } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { activateReviewView } from "@true-recall/obsidian/plugin/ViewActivator";

vi.mock("obsidian", () => ({
	Platform: { isMobile: false },
}));

function createLeaf() {
	return {
		setViewState: vi.fn().mockResolvedValue(undefined),
	};
}

function createApp(options: { openReviewCount?: number } = {}) {
	const leaf = createLeaf();
	const workspace = {
		getLeavesOfType: vi.fn(() =>
			Array.from({ length: options.openReviewCount ?? 0 }, createLeaf),
		),
		getLeaf: vi.fn(() => leaf),
		getRightLeaf: vi.fn(() => leaf),
		revealLeaf: vi.fn(),
	};

	return {
		app: { workspace } as unknown as App,
		leaf: leaf as unknown as WorkspaceLeaf,
		workspace,
	};
}

describe("activateReviewView", () => {
	it("opens the first panel review in the existing right sidebar leaf", async () => {
		const { app, leaf, workspace } = createApp();

		const result = await activateReviewView(app, "review", "panel", {
			projectPath: "Projects/A.md",
		});

		expect(result).toBe(leaf);
		expect(workspace.getRightLeaf).toHaveBeenCalledWith(false);
		expect(workspace.revealLeaf).toHaveBeenCalledWith(leaf);
	});

	it("creates another right sidebar leaf when a review is already open", async () => {
		const { app, leaf, workspace } = createApp({ openReviewCount: 1 });

		const result = await activateReviewView(app, "review", "panel", {
			projectPath: "Projects/B.md",
		});

		expect(result).toBe(leaf);
		expect(workspace.getRightLeaf).toHaveBeenCalledWith(true);
		expect(workspace.getLeavesOfType).toHaveBeenCalledWith("review");
	});

	it("always creates a new main-area tab in fullscreen mode", async () => {
		const { app, leaf, workspace } = createApp({ openReviewCount: 1 });

		const result = await activateReviewView(app, "review", "fullscreen", {
			sourceUidFilter: "source-2",
		});

		expect(result).toBe(leaf);
		expect(workspace.getLeaf).toHaveBeenCalledWith(true);
		expect(workspace.getRightLeaf).not.toHaveBeenCalled();
	});
});
