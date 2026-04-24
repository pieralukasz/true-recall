import type { PluginManifest } from "../types";

export const statusBarWidgetManifest: PluginManifest = {
	info: {
		id: "status-bar-widget",
		name: "Status Bar Widget",
		description:
			"Show due, new, and learning card counts directly in Obsidian's status bar with color-coded indicators. Click the widget to jump straight into your dashboard without breaking flow.",
		features: [
			"Persistent count display in status bar",
			"Color-coded new/learning/due indicators",
			"Click to open dashboard",
		],
		icon: "bar-chart-2",
		tier: "free",
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
