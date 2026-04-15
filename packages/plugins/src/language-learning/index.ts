import type { PluginManifest } from "../types";
import { LanguageLearningSettingsPanel } from "./settings-panel";

export const languageLearningManifest: PluginManifest = {
	info: {
		id: "language-learning",
		name: "Language Learning",
		description:
			"Generate vocabulary flashcards with language-aware prompts and TTS audio for any note type.",
		features: [
			"Works with any note type",
			"29 supported languages",
			"Text-to-speech audio generation",
			"Server-side language prompt injection (Pro)",
		],
		icon: "languages",
		requiresPro: true,
	},
	toolbarButtonIds: ["vocab"],
	settingsPanel: LanguageLearningSettingsPanel,
};
