import type { PluginManifest } from "../types";
import { LanguageLearningSettingsPanel } from "./settings-panel";

export const languageLearningManifest: PluginManifest = {
	info: {
		id: "language-learning",
		name: "Language Learning",
		description:
			"Study vocabulary with language-specific flashcard presets, TTS audio, and targeted generation prompts.",
		features: [
			"29 language presets with curated prompts",
			"Text-to-speech audio generation",
			"Per-preset source and target language",
			"Custom vocabulary note types",
		],
		icon: "languages",
		requiresPro: true,
	},
	toolbarButtonIds: ["vocab"],
	settingsPanel: LanguageLearningSettingsPanel,
};
