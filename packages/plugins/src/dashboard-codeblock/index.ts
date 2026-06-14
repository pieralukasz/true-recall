import type { PluginManifest } from "../types";

let registered = false;

export const dashboardCodeblockManifest: PluginManifest = {
	info: {
		id: "dashboard-codeblock",
		name: "Dashboard Codeblocks",
		description:
			"Embed True Recall dashboards directly in your notes as codeblocks. Includes global due/new/learning counts, analytics (streaks, heatmaps, workload), project overviews, FSRS forecasts, and per-note health widgets.",
		features: [
			"Global dashboard with due/new/learning counts",
			"Analytics widgets (streak, health, heatmap, workload)",
			"Project management widgets",
			"FSRS management widgets (retention, forecast, problem cards)",
			"Per-note health and decay widgets",
		],
		icon: "layout-dashboard",
		tier: "free",
	},
	activate: (ctx) => {
		const { obsidianPlugin: plugin } = ctx;

		// Codeblock processors can't be unregistered mid-session — register once
		// and gate rendering and commands live via `isEnabled`.
		if (registered) return;
		registered = true;

		const isEnabled = () =>
			plugin.settings.pluginStates?.["dashboard-codeblock"] !== false;

		void import("./DashboardCodeblock").then(
			({ registerCoreDashboardCodeblocks }) => {
				registerCoreDashboardCodeblocks(plugin, isEnabled);
			},
		);

		plugin.addCommand({
			id: "insert-project-dashboard",
			name: "Insert project dashboard",
			editorCheckCallback: (checking, editor) => {
				if (!isEnabled()) return false;
				if (checking) return true;
				editor.replaceSelection("```true-recall-project\n```\n");
				return true;
			},
		});

		plugin.addCommand({
			id: "create-master-dashboard",
			name: "Create master dashboard note",
			checkCallback: (checking) => {
				if (!isEnabled()) return false;
				if (checking) return true;
				void plugin.createMasterDashboard();
				return true;
			},
		});
	},
};
