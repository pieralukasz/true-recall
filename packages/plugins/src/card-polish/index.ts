import { createCardAISettingsPanel } from "../shared/createCardAISettingsPanel";
import type { PluginManifest } from "../types";
import { CARD_POLISH_BUILTINS } from "./builtins";
import { CardPolishPlugin } from "./CardPolishPlugin";

export const cardPolishManifest: PluginManifest = {
	info: {
		id: "card-polish",
		name: "Card Polish",
		description:
			"Transform flashcards mid-review or inside the Add Flashcard modal — fix formatting, simplify wording, or run your own custom instructions. Each preset can auto-apply or show a preview, and supports its own hotkey during review.",
		features: [
			"Polish cards mid-review",
			"Polish + fill in the Add Flashcard modal",
			"Per-preset auto-apply or preview",
			"Hotkey support for each preset (review only)",
			"Optional source-note and related-card context per preset",
		],
		icon: "wand-2",
		tier: "byok",
		deprecated: {
			replacementId: "ai-assistant",
			message:
				"Kept for existing workflows. Its custom presets are now also available directly in AI Assistant.",
		},
	},
	settingsPanel: createCardAISettingsPanel({
		bucketKey: "cardPolish",
		builtins: CARD_POLISH_BUILTINS,
		description:
			"Polish presets work in review and in the Add Flashcard modal.",
		lmStudioField: {
			modelKey: "lmStudioCardPolishModel",
			name: "LM Studio model",
			description:
				"Used only by Card Polish when LM Studio is the selected provider.",
		},
	}),
	activate: (ctx) => {
		const plugin = new CardPolishPlugin(ctx);
		plugin.activate();
		return () => plugin.deactivate();
	},
};
