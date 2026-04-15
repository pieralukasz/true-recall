import type TrueRecallPlugin from "../main";
import { isPluginEnabled } from "./plugin-utils";
import {
	type Cleanup,
	PLUGIN_MANIFESTS,
	type PluginContext,
} from "@true-recall/plugins";

export class PluginLoader {
	private cleanups = new Map<string, Cleanup>();

	constructor(private plugin: TrueRecallPlugin) {}

	activateAll(): void {
		for (const manifest of PLUGIN_MANIFESTS) {
			if (!manifest.activate) continue;
			if (!this.isEnabled(manifest.info.id)) continue;

			try {
				const ctx = this.buildContext();
				const cleanup = manifest.activate(ctx);
				if (cleanup) this.cleanups.set(manifest.info.id, cleanup);
			} catch (e) {
				console.error(
					`[True Recall] Failed to activate plugin "${manifest.info.name}":`,
					e,
				);
			}
		}
	}

	deactivateAll(): void {
		for (const [id, cleanup] of this.cleanups) {
			try {
				cleanup();
			} catch (e) {
				console.error(`[True Recall] Failed to deactivate plugin "${id}":`, e);
			}
		}
		this.cleanups.clear();

		for (const manifest of PLUGIN_MANIFESTS) {
			manifest.deactivate?.();
		}
	}

	private isEnabled(id: string): boolean {
		return isPluginEnabled(this.plugin.settings, id);
	}

	private buildContext(): PluginContext {
		const plugin = this.plugin;
		const dataLayer = plugin.dataLayer;
		if (!dataLayer) throw new Error("DataLayer not initialized");

		return {
			obsidianPlugin: plugin,
			app: plugin.app,
			workspace: plugin.app.workspace,
			trueRecallApp: plugin.coreApp,
			dataLayer,
			settings: plugin.settings,
			save: async (patch) => {
				Object.assign(plugin.settings, patch);
				await plugin.saveSettings();
			},
		};
	}
}
