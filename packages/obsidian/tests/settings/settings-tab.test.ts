import { beforeEach, describe, expect, it, vi } from "vitest";

const { mountPreactMock } = vi.hoisted(() => ({
	mountPreactMock: vi.fn(),
}));

vi.mock("@true-recall/obsidian/preact", () => ({
	mountPreact: mountPreactMock,
}));

import { TrueRecallSettingTab } from "../../src/settings/SettingsTab";
import { SETTINGS_PAGES } from "../../src/settings/settings-pages";

describe("TrueRecallSettingTab", () => {
	beforeEach(() => {
		mountPreactMock.mockReset();
	});

	it("exposes cheap native pages without mounting the UI", () => {
		const tab = createTab();

		const definitions = tab.getSettingDefinitions();

		expect(definitions).toHaveLength(SETTINGS_PAGES.length);
		expect(definitions).toEqual(
			SETTINGS_PAGES.map((page) =>
				expect.objectContaining({
					type: "page",
					name: page.name,
					desc: page.description,
					items: [
						expect.objectContaining({
							name: `${page.name} options`,
							aliases: [...page.searchAliases],
							render: expect.any(Function),
						}),
					],
				}),
			),
		);
		expect(mountPreactMock).not.toHaveBeenCalled();
	});

	it("mounts a page lazily from its declarative render callback", () => {
		const unmount = vi.fn();
		mountPreactMock.mockReturnValue(unmount);
		const tab = createTab();
		const settingEl = createElement();
		const definition = tab.getSettingDefinitions()[1];
		if (!definition || !("items" in definition)) {
			throw new Error("Expected a native page definition");
		}
		const content = definition.items?.[0];
		if (!content || !("render" in content) || !content.render) {
			throw new Error("Expected a page render definition");
		}

		const cleanup = content.render({ settingEl } as never, {} as never);

		expect(settingEl.empty).toHaveBeenCalledOnce();
		expect(settingEl.addClass).toHaveBeenCalledWith(
			"true-recall-settings-root",
		);
		expect(settingEl.addClass).toHaveBeenCalledWith("tr-settings");
		expect(mountPreactMock).toHaveBeenCalledWith(
			settingEl,
			expect.anything(),
			expect.objectContaining({ props: { pageId: "fsrs" } }),
		);
		cleanup?.();
		expect(unmount).toHaveBeenCalledOnce();
	});

	it("uses only the declarative API supported by the plugin manifest", () => {
		expect(Object.hasOwn(TrueRecallSettingTab.prototype, "display")).toBe(
			false,
		);
	});

	it("tracks page cleanups independently and makes them idempotent", () => {
		const firstUnmount = vi.fn();
		const secondUnmount = vi.fn();
		mountPreactMock
			.mockReturnValueOnce(firstUnmount)
			.mockReturnValueOnce(secondUnmount);
		const tab = createTab();
		const definitions = tab.getSettingDefinitions();
		const firstRender = getPageRender(definitions[0]);
		const secondRender = getPageRender(definitions[1]);
		const firstCleanup = firstRender(
			{ settingEl: createElement() } as never,
			{} as never,
		);
		secondRender({ settingEl: createElement() } as never, {} as never);

		firstCleanup?.();
		firstCleanup?.();
		tab.hide();

		expect(firstUnmount).toHaveBeenCalledOnce();
		expect(secondUnmount).toHaveBeenCalledOnce();
	});

	it("unmounts a page before reusing the same render container", () => {
		const firstUnmount = vi.fn();
		const secondUnmount = vi.fn();
		mountPreactMock
			.mockReturnValueOnce(firstUnmount)
			.mockReturnValueOnce(secondUnmount);
		const tab = createTab();
		const render = getPageRender(tab.getSettingDefinitions()[0]);
		const settingEl = createElement();

		render({ settingEl } as never, {} as never);
		const cleanup = render({ settingEl } as never, {} as never);
		cleanup?.();

		expect(firstUnmount).toHaveBeenCalledOnce();
		expect(secondUnmount).toHaveBeenCalledOnce();
	});
});

function createTab() {
	const plugin = { app: {}, settings: { defaultPresetId: "default" } };
	return new TrueRecallSettingTab(plugin.app as never, plugin as never);
}

function createElement() {
	return {
		empty: vi.fn(),
		addClass: vi.fn(),
	};
}

function getPageRender(
	definition: ReturnType<TrueRecallSettingTab["getSettingDefinitions"]>[number],
) {
	if (!definition || !("items" in definition)) {
		throw new Error("Expected a native page definition");
	}
	const content = definition.items?.[0];
	if (!content || !("render" in content) || !content.render) {
		throw new Error("Expected a page render definition");
	}
	return content.render;
}
