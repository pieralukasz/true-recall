import type { PluginManifest } from "../types";

export const healingFlashcardsManifest: PluginManifest = {
	info: {
		id: "healing-flashcards",
		name: "Healing Flashcards",
		description:
			"Automatically generate flashcards that target your weak spots, based on review mistakes and lapse patterns.",
		features: [
			"Detects recurring mistakes from review history",
			"Generates corrective cards for problem areas",
			"Adapts to your learning patterns over time",
		],
		icon: "heart-pulse",
		requiresPro: true,
	},
};
