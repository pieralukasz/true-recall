import type { PluginManifest } from "../types";

export const gamificationManifest: PluginManifest = {
	info: {
		id: "gamification",
		name: "Gamification Widgets",
		description:
			"Track your study progress with visual widgets: progress rings, achievements, streaks, and countdowns.",
		features: [
			"Daily progress rings (new + review)",
			"Achievement badges based on study milestones",
			"Answer streak counter",
			"Exam countdown with retention prediction",
			"Card maturity distribution",
			"Rating distribution chart",
		],
		icon: "trophy",
		tier: "pro",
	},
	activate: (ctx) => {
		const { obsidianPlugin: plugin } = ctx;

		void import("./register").then(({ registerGamificationCodeblocks }) => {
			registerGamificationCodeblocks(plugin);
		});
	},
};
