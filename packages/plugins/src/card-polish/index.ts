import { createCardAISettingsPanel } from "../shared/createCardAISettingsPanel";
import type { PluginManifest } from "../types";
import { CARD_POLISH_BUILTINS } from "./builtins";
import { CardPolishPlugin } from "./CardPolishPlugin";

export const cardPolishManifest: PluginManifest = {
	info: {
		id: "card-polish",
		name: "Card Polish",
		description:
			"Presets that transform an existing flashcard — fix formatting, simplify wording, split a card. They run in the AI workspace (✨ during review, or the Card Polish tab), so the Assistant feature has to be on too.",
		features: [
			"Polish cards mid-review from the ✨ action",
			"Polish + fill while editing a flashcard",
			"Per-preset auto-apply or preview",
			"Hotkey support for each preset (review only)",
			"Optional source-note and related-card context per preset",
		],
		icon: "wand-2",
		tier: "byok",
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
