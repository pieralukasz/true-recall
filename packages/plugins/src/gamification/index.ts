import type { PluginManifest } from "../types";

export const gamificationManifest: PluginManifest = {
	info: {
		id: "gamification",
		name: "Gamification Widgets",
		description:
			"Turn your review habit into visible progress with codeblock widgets — daily progress rings, achievement badges, answer streaks, and exam countdowns with retention prediction. Drop them into daily notes or a dedicated dashboard to see momentum at a glance.",
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
