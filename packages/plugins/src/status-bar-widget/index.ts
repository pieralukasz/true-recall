import type { PluginManifest } from "../types";

export const statusBarWidgetManifest: PluginManifest = {
	info: {
		id: "status-bar-widget",
		name: "Status Bar Widget",
		description:
			"Show due, new, and learning card counts in Obsidian's status bar.",
		features: [
			"Persistent count display in status bar",
			"Color-coded new/learning/due indicators",
			"Click to open dashboard",
		],
		icon: "bar-chart-2",
		requiresPro: false,
	},
	activate: (ctx) => {
		const { obsidianPlugin: plugin } = ctx;
		let disposed = false;

		void import("./StatusBarWidget")
			.then(({ StatusBarWidget }) => {
				if (disposed) return;
				const statusBarEl = plugin.addStatusBarItem();
				plugin.statusBarWidget = new StatusBarWidget(
					statusBarEl,
					plugin.flashcardManager,
					() => {
						plugin.openDashboard().catch(() => {});
					},
					() => plugin.settings.showStatusBarWidget,
					{
						presetService: plugin.presetService,
						sessionPersistence: plugin.sessionPersistence,
					},
				);
				plugin.statusBarWidget.start();
			})
			.catch((e) => {
				console.warn("[True Recall] Failed to load status bar widget:", e);
			});

		return () => {
			disposed = true;
			plugin.statusBarWidget?.dispose();
			plugin.statusBarWidget = null;
		};
	},
};
