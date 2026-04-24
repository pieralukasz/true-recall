import type { PluginManifest } from "../types";

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

		void import("./DashboardCodeblock").then(
			({ registerCoreDashboardCodeblocks }) => {
				registerCoreDashboardCodeblocks(plugin);
			},
		);

		plugin.addCommand({
			id: "insert-project-dashboard",
			name: "Insert project dashboard",
			editorCheckCallback: (checking, editor) => {
				if (checking) return true;
				editor.replaceSelection("```true-recall-project\n```\n");
				return true;
			},
		});

		plugin.addCommand({
			id: "create-master-dashboard",
			name: "Create master dashboard note",
			callback: () => void plugin.createMasterDashboard(),
		});
	},
};
