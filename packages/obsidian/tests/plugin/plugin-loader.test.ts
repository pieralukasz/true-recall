import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";

import type TrueRecallPlugin from "../../src/main";
import { PluginLoader } from "../../src/plugin/plugin-loader";
import type { PluginManifest } from "@true-recall/plugins";

vi.mock("@true-recall/plugins", () => ({
	PLUGIN_MANIFESTS: [],
}));

function makePlugin(
	pluginStates: Record<string, boolean> = {},
): TrueRecallPlugin {
	return {
		settings: { ...DEFAULT_SETTINGS, pluginStates },
		app: {
			workspace: {
				updateOptions: vi.fn(),
				iterateAllLeaves: vi.fn(),
			},
		},
		dataLayer: {},
		coreApp: {},
		saveSettings: vi.fn(),
	} as unknown as TrueRecallPlugin;
}

function makeManifest(id: string) {
	const cleanup = vi.fn();
	const activate = vi.fn(() => cleanup);
	const manifest = {
		info: {
			id,
			name: id,
			description: "",
			features: [],
			icon: "x",
			tier: "free",
		},
		activate,
	} as unknown as PluginManifest;
	return { manifest, activate, cleanup };
}

describe("PluginLoader", () => {
	let pluginA: ReturnType<typeof makeManifest>;
	let pluginB: ReturnType<typeof makeManifest>;

	beforeEach(() => {
		pluginA = makeManifest("plugin-a");
		pluginB = makeManifest("plugin-b");
	});

	describe("activateAll", () => {
		it("activates enabled plugins and skips disabled ones", () => {
			const plugin = makePlugin({ "plugin-b": false });
			const loader = new PluginLoader(plugin, [
				pluginA.manifest,
				pluginB.manifest,
			]);

			loader.activateAll();

			expect(pluginA.activate).toHaveBeenCalledTimes(1);
			expect(pluginB.activate).not.toHaveBeenCalled();
		});

		it("ignores manifests without an activate function", () => {
			const plugin = makePlugin();
			const noActivate = {
				info: { id: "panel-only", tier: "free" },
			} as PluginManifest;
			const loader = new PluginLoader(plugin, [noActivate]);

			expect(() => loader.activateAll()).not.toThrow();
		});
	});

	describe("sync", () => {
		it("deactivates a plugin when its state is toggled off", () => {
			const plugin = makePlugin();
			const loader = new PluginLoader(plugin, [pluginA.manifest]);
			loader.activateAll();

			plugin.settings.pluginStates = { "plugin-a": false };
			loader.sync();

			expect(pluginA.cleanup).toHaveBeenCalledTimes(1);
		});

		it("activates a plugin that was disabled at startup when toggled on", () => {
			const plugin = makePlugin({ "plugin-a": false });
			const loader = new PluginLoader(plugin, [pluginA.manifest]);
			loader.activateAll();
			expect(pluginA.activate).not.toHaveBeenCalled();

			plugin.settings.pluginStates = { "plugin-a": true };
			loader.sync();

			expect(pluginA.activate).toHaveBeenCalledTimes(1);
		});

		it("re-activates a plugin after disable then enable", () => {
			const plugin = makePlugin();
			const loader = new PluginLoader(plugin, [pluginA.manifest]);
			loader.activateAll();

			plugin.settings.pluginStates = { "plugin-a": false };
			loader.sync();
			plugin.settings.pluginStates = { "plugin-a": true };
			loader.sync();

			expect(pluginA.activate).toHaveBeenCalledTimes(2);
			expect(pluginA.cleanup).toHaveBeenCalledTimes(1);
		});

		it("does nothing when states have not changed", () => {
			const plugin = makePlugin();
			const loader = new PluginLoader(plugin, [pluginA.manifest]);
			loader.activateAll();

			loader.sync();
			loader.sync();

			expect(pluginA.activate).toHaveBeenCalledTimes(1);
			expect(pluginA.cleanup).not.toHaveBeenCalled();
			expect(plugin.app.workspace.updateOptions).not.toHaveBeenCalled();
		});

		it("refreshes editor options only when a plugin was toggled", () => {
			const plugin = makePlugin();
			const loader = new PluginLoader(plugin, [pluginA.manifest]);
			loader.activateAll();

			plugin.settings.pluginStates = { "plugin-a": false };
			loader.sync();

			expect(plugin.app.workspace.updateOptions).toHaveBeenCalledTimes(1);
		});
	});

	describe("deactivateAll", () => {
		it("runs all cleanups and allows re-activation afterwards", () => {
			const plugin = makePlugin();
			const loader = new PluginLoader(plugin, [pluginA.manifest]);
			loader.activateAll();

			loader.deactivateAll();
			expect(pluginA.cleanup).toHaveBeenCalledTimes(1);

			loader.activateAll();
			expect(pluginA.activate).toHaveBeenCalledTimes(2);
		});
	});
});
