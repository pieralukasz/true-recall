import type TrueRecallPlugin from "../main";
import { isPluginEnabled } from "./plugin-utils";
import {
	type Cleanup,
	PLUGIN_MANIFESTS,
	type PluginContext,
	type PluginManifest,
} from "@true-recall/plugins";

export class PluginLoader {
	private cleanups = new Map<string, Cleanup>();
	private active = new Set<string>();

	constructor(
		private plugin: TrueRecallPlugin,
		private manifests: PluginManifest[] = PLUGIN_MANIFESTS,
	) {}

	activateAll(): void {
		for (const manifest of this.manifests) {
			if (!manifest.activate) continue;
			if (!this.isEnabled(manifest.info.id)) continue;
			this.activateOne(manifest);
		}
	}

	/**
	 * Reconcile runtime state with `settings.pluginStates`. Activates plugins
	 * toggled on and deactivates plugins toggled off since the last sync, so
	 * toggles apply without an Obsidian restart. Manifest activate functions
	 * must therefore be safe to re-run within a session (one-time registrations
	 * like CM6 extensions guard themselves and gate behavior via live checks).
	 */
	sync(): void {
		let changed = false;
		for (const manifest of this.manifests) {
			if (!manifest.activate) continue;
			const id = manifest.info.id;
			const shouldBeActive = this.isEnabled(id);
			if (shouldBeActive === this.active.has(id)) continue;

			if (shouldBeActive) {
				this.activateOne(manifest);
			} else {
				this.deactivateOne(manifest);
			}
			changed = true;
		}

		for (const manifest of this.manifests) {
			if (this.active.has(manifest.info.id)) manifest.sync?.();
		}

		if (changed) this.refreshViews();
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
		this.active.clear();

		for (const manifest of this.manifests) {
			manifest.deactivate?.();
		}
	}

	private activateOne(manifest: PluginManifest): void {
		if (!manifest.activate) return;
		try {
			const ctx = this.buildContext();
			const cleanup = manifest.activate(ctx);
			if (cleanup) this.cleanups.set(manifest.info.id, cleanup);
			this.active.add(manifest.info.id);
		} catch (e) {
			console.error(
				`[True Recall] Failed to activate plugin "${manifest.info.name}":`,
				e,
			);
		}
	}

	private deactivateOne(manifest: PluginManifest): void {
		const id = manifest.info.id;
		const cleanup = this.cleanups.get(id);
		if (cleanup) {
			try {
				cleanup();
			} catch (e) {
				console.error(`[True Recall] Failed to deactivate plugin "${id}":`, e);
			}
			this.cleanups.delete(id);
		}
		this.active.delete(id);
	}

	/**
	 * Force open editors and reading views to re-evaluate plugin-gated
	 * decorations, toolbars, and codeblock widgets after a toggle.
	 */
	private refreshViews(): void {
		this.plugin.app.workspace.updateOptions();
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view as unknown as {
				getViewType?: () => string;
				previewMode?: { rerender?: (full?: boolean) => void };
			};
			if (view?.getViewType?.() === "markdown") {
				view.previewMode?.rerender?.(true);
			}
		});
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
