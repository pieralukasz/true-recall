import type { ItemView } from "obsidian";
import { describe, expect, it } from "vitest";

import { createViewVisibility } from "@true-recall/obsidian/views/view-visibility";

function createFakeView(initialShown: boolean) {
	let shown = initialShown;
	const workspaceHandlers = new Map<string, () => void>();
	const layoutReadyCallbacks: Array<() => void> = [];

	const view = {
		containerEl: { isShown: () => shown },
		registerEvent: () => {},
		app: {
			workspace: {
				on: (name: string, callback: () => void) => {
					workspaceHandlers.set(name, callback);
					return { name };
				},
				onLayoutReady: (callback: () => void) => {
					layoutReadyCallbacks.push(callback);
				},
			},
		},
	} as unknown as ItemView;

	return {
		view,
		setShown: (value: boolean) => {
			shown = value;
		},
		fire: (name: string) => workspaceHandlers.get(name)?.(),
		fireLayoutReady: () => {
			for (const callback of layoutReadyCallbacks.splice(0)) callback();
		},
	};
}

describe("createViewVisibility", () => {
	it("seeds the signal from the container's current visibility", () => {
		expect(createViewVisibility(createFakeView(true).view).value).toBe(true);
		expect(createViewVisibility(createFakeView(false).view).value).toBe(false);
	});

	it.each([
		"layout-change",
		"active-leaf-change",
	])("updates the signal on %s", (eventName) => {
		const fake = createFakeView(false);
		const isVisible = createViewVisibility(fake.view);

		fake.setShown(true);
		fake.fire(eventName);

		expect(isVisible.value).toBe(true);
	});

	it("re-checks visibility once the workspace layout becomes ready", () => {
		// Startup race: the signal seeds false during workspace restore and no
		// layout-change/active-leaf-change fires after the container is shown.
		const fake = createFakeView(false);
		const isVisible = createViewVisibility(fake.view);

		fake.setShown(true);
		fake.fireLayoutReady();

		expect(isVisible.value).toBe(true);
	});
});
