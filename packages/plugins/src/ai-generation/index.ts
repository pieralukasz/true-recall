import type { PluginManifest } from "../types";
import { AIGenerationSettingsPanel } from "./settings-panel";

export const aiGenerationManifest: PluginManifest = {
	info: {
		id: "ai-generation",
		name: "AI Flashcard Generation",
		description: "Generate flashcards with AI using customizable presets",
		features: ["AI generation", "TTS", "Image generation", "Custom presets"],
		icon: "sparkles",
		requiresPro: true,
	},
	settingsPanel: AIGenerationSettingsPanel,
};
