import type { App, WorkspaceLeaf } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import {
	activateReviewView,
	revealReviewView,
} from "@true-recall/obsidian/plugin/ViewActivator";

vi.mock("obsidian", () => ({
	Platform: { isMobile: false },
}));

function createLeaf(
	state: Record<string, unknown> = {},
	setViewState = vi.fn().mockResolvedValue(undefined),
) {
	return {
		getViewState: vi.fn(() => ({ type: "review", state })),
		setViewState,
	};
}

function createApp(
	options: { openReviewStates?: Record<string, unknown>[] } = {},
) {
	const leaf = createLeaf();
	const openLeaves = (options.openReviewStates ?? []).map((state) =>
		createLeaf(state),
	);
	const workspace = {
		getLeavesOfType: vi.fn(() => openLeaves),
		getLeaf: vi.fn(() => leaf),
		getRightLeaf: vi.fn(() => leaf),
		revealLeaf: vi.fn(),
	};

	return {
		app: { workspace } as unknown as App,
		leaf: leaf as unknown as WorkspaceLeaf,
		openLeaves: openLeaves as unknown as WorkspaceLeaf[],
		workspace,
	};
}

describe("revealReviewView", () => {
	it("reveals the review with the same state without replacing it", () => {
		const { app, openLeaves, workspace } = createApp({
			openReviewStates: [
				{ projectPath: "Projects/A.md" },
				{ projectPath: "Projects/B.md" },
			],
		});

		const result = revealReviewView(app, "review", {
			projectPath: "Projects/B.md",
		});

		expect(result).toBe(openLeaves[1]);
		expect(workspace.revealLeaf).toHaveBeenCalledWith(openLeaves[1]);
		expect(openLeaves[1]?.setViewState).not.toHaveBeenCalled();
	});

	it("matches restored state regardless of key order and undefined fields", () => {
		const { app, openLeaves } = createApp({
			openReviewStates: [
				{
					schedulingMode: "due",
					sourceUidFilter: "source-1",
				},
			],
		});

		const result = revealReviewView(app, "review", {
			sourceUidFilter: "source-1",
			unused: undefined,
			schedulingMode: "due",
		});

		expect(result).toBe(openLeaves[0]);
	});

	it("uses the launcher key even when transient session state changed", () => {
		const { app, openLeaves } = createApp({
			openReviewStates: [
				{
					sessionKey: "note:uid-1",
					topUp: { kind: "review", count: 10 },
				},
			],
		});

		const result = revealReviewView(app, "review", {
			sessionKey: "note:uid-1",
		});

		expect(result).toBe(openLeaves[0]);
	});

	it("does not confuse sessions whose ordered state differs", () => {
		const { app, workspace } = createApp({
			openReviewStates: [{ sourceNoteFilters: ["A", "B"] }],
		});

		const result = revealReviewView(app, "review", {
			sourceNoteFilters: ["B", "A"],
		});

		expect(result).toBeNull();
		expect(workspace.revealLeaf).not.toHaveBeenCalled();
	});
});

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

	it("reveals the matching panel review instead of creating another", async () => {
		const state = { projectPath: "Projects/A.md" };
		const { app, openLeaves, workspace } = createApp({
			openReviewStates: [state],
		});

		const result = await activateReviewView(app, "review", "panel", state);

		expect(result).toBe(openLeaves[0]);
		expect(workspace.getRightLeaf).not.toHaveBeenCalled();
		expect(workspace.revealLeaf).toHaveBeenCalledWith(openLeaves[0]);
	});

	it("creates another right sidebar leaf for a different session", async () => {
		const { app, leaf, workspace } = createApp({
			openReviewStates: [{ projectPath: "Projects/A.md" }],
		});

		const result = await activateReviewView(app, "review", "panel", {
			projectPath: "Projects/B.md",
		});

		expect(result).toBe(leaf);
		expect(workspace.getRightLeaf).toHaveBeenCalledWith(true);
		expect(workspace.getLeavesOfType).toHaveBeenCalledWith("review");
	});

	it("reveals the matching main-area review instead of creating another", async () => {
		const state = { sourceUidFilter: "source-2" };
		const { app, openLeaves, workspace } = createApp({
			openReviewStates: [state],
		});

		const result = await activateReviewView(app, "review", "fullscreen", state);

		expect(result).toBe(openLeaves[0]);
		expect(workspace.getLeaf).not.toHaveBeenCalled();
		expect(workspace.getRightLeaf).not.toHaveBeenCalled();
	});

	it("creates a new main-area tab for a different fullscreen session", async () => {
		const { app, leaf, workspace } = createApp({
			openReviewStates: [{ sourceUidFilter: "source-1" }],
		});

		const result = await activateReviewView(app, "review", "fullscreen", {
			sourceUidFilter: "source-2",
		});

		expect(result).toBe(leaf);
		expect(workspace.getLeaf).toHaveBeenCalledWith(true);
		expect(workspace.getRightLeaf).not.toHaveBeenCalled();
	});

	it("coalesces concurrent requests for the same session", async () => {
		let finishOpening: (() => void) | undefined;
		const setViewState = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishOpening = resolve;
				}),
		);
		const leaf = createLeaf({}, setViewState);
		const workspace = {
			getLeavesOfType: vi.fn(() => []),
			getLeaf: vi.fn(() => leaf),
			getRightLeaf: vi.fn(() => leaf),
			revealLeaf: vi.fn(),
		};
		const app = { workspace } as unknown as App;
		const state = { projectPath: "Projects/A.md" };

		const first = activateReviewView(app, "review", "fullscreen", state);
		const second = activateReviewView(app, "review", "fullscreen", state);
		finishOpening?.();

		await expect(first).resolves.toBe(leaf);
		await expect(second).resolves.toBe(leaf);
		expect(workspace.getLeaf).toHaveBeenCalledTimes(1);
		expect(setViewState).toHaveBeenCalledTimes(1);
	});
});
