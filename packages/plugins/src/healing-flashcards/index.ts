import type { PluginManifest } from "../types";

export const healingFlashcardsManifest: PluginManifest = {
	info: {
		id: "healing-flashcards",
		name: "Healing Flashcards",
		description:
			"Automatically generate corrective flashcards that target your weak spots, based on recurring mistakes and lapse patterns in your review history. The plugin adapts to your learning curve and focuses new cards on the areas you keep forgetting.",
		features: [
			"Detects recurring mistakes from review history",
			"Generates corrective cards for problem areas",
			"Adapts to your learning patterns over time",
		],
		icon: "heart-pulse",
		tier: "pro",
	},
};
