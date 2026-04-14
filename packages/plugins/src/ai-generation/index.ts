import type { PluginManifest } from "../types";
import { AIGenerationSettingsPanel } from "./settings-panel";

export const aiGenerationManifest: PluginManifest = {
	info: {
		id: "ai-generation",
		name: "AI Flashcard Generation",
		description:
			"Generate flashcards from your notes using AI. Select text, pick a note type, and let AI create structured flashcards.",
		features: [
			"Generate from selected text or entire notes",
			"Multiple note type support (basic, cloze, reversed)",
			"Custom generation prompts",
			"Semantic answer grading in type-in mode",
		],
		icon: "sparkles",
		requiresPro: true,
	},
	settingsPanel: AIGenerationSettingsPanel,
};
