import { createCardAISettingsPanel } from "../shared/createCardAISettingsPanel";
import type { PluginManifest } from "../types";
import { AI_GENERATION_BUILTINS } from "./builtins";

export const aiGenerationManifest: PluginManifest = {
	info: {
		id: "ai-generation",
		name: "AI Flashcard Generation",
		description:
			"Generate new flashcards from a note. Pro users get a hosted built-in preset; everyone can add their own.",
		features: [
			"Generate cards from a whole note (from the toolbar, coming soon)",
			"Pro-hosted built-in preset",
			"Custom presets with source-note context",
		],
		icon: "sparkles",
		requiresPro: false,
	},
	settingsPanel: createCardAISettingsPanel({
		bucketKey: "flashcardGeneration",
		builtins: AI_GENERATION_BUILTINS,
		description:
			"Generate new flashcards from a note. Pro users see the hosted built-in; custom presets run against Pro or your BYOK key.",
	}),
};
