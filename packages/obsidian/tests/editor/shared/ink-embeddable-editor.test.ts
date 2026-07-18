import { describe, expect, it, vi } from "vitest";

import {
	getInkEmbeddableEditorExtensions,
	getInkIntegrationStatus,
} from "../../../src/editor/shared/ink-embeddable-editor";

describe("getInkEmbeddableEditorExtensions", () => {
	it("returns no extensions when Ink is unavailable", () => {
		const app = { plugins: { getPlugin: vi.fn(() => null) } };

		expect(getInkEmbeddableEditorExtensions(app, "Notes/Card.md")).toEqual([]);
		expect(app.plugins.getPlugin).toHaveBeenCalledWith("ink");
	});

	it("passes the source path to Ink and preserves the plugin receiver", () => {
		const extension = {};
		const inkPlugin = {
			marker: "ink",
			getEmbeddableEditorExtensions(this: { marker: string }, path: string) {
				return [{ extension, marker: this.marker, path }];
			},
		};
		const app = { plugins: { getPlugin: () => inkPlugin } };

		expect(getInkEmbeddableEditorExtensions(app, "Notes/Card.md")).toEqual([
			{ extension, marker: "ink", path: "Notes/Card.md" },
		]);
	});

	it("supports older Ink versions without the shared-editor API", () => {
		const app = { plugins: { getPlugin: () => ({}) } };

		expect(getInkEmbeddableEditorExtensions(app, "")).toEqual([]);
	});
});

describe("getInkIntegrationStatus", () => {
	it.each([
		[
			"not installed",
			{ plugins: { getPlugin: () => null, manifests: {} } },
			"not-installed",
		],
		[
			"installed but disabled",
			{ plugins: { getPlugin: () => null, manifests: { ink: {} } } },
			"disabled",
		],
		[
			"enabled but incompatible",
			{ plugins: { getPlugin: () => ({}), manifests: { ink: {} } } },
			"incompatible",
		],
		[
			"ready",
			{
				plugins: {
					getPlugin: () => ({ getEmbeddableEditorExtensions: () => [] }),
					manifests: { ink: {} },
				},
			},
			"ready",
		],
	] as const)("reports %s", (_label, app, expected) => {
		expect(getInkIntegrationStatus(app)).toBe(expected);
	});
});
