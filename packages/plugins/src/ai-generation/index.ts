import type { PluginManifest } from "../types";
import { AIGenerationSettingsPanel } from "./AIGenerationSettingsPanel";

export const aiGenerationManifest: PluginManifest = {
	info: {
		id: "ai-generation",
		name: "Flashcard Generator",
		description:
			"Generate new flashcards from a note. Write one prompt per preset — pick a note type and the pipeline fills its fields.",
		features: [
			"Generate cards from notes, selections, and highlights",
			"Pro-hosted built-in preset",
			"Custom presets with source-note context",
		],
		icon: "layers",
		tier: "byok",
	},
	settingsPanel: AIGenerationSettingsPanel,
};
