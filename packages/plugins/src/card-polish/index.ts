import { createCardAISettingsPanel } from "../shared/createCardAISettingsPanel";
import type { PluginManifest } from "../types";
import { CARD_POLISH_BUILTINS } from "./builtins";
import { CardPolishPlugin } from "./CardPolishPlugin";

export const cardPolishManifest: PluginManifest = {
	info: {
		id: "card-polish",
		name: "Card Polish",
		description:
			"Transform flashcards during review or in the Add Flashcard modal — fix formatting, simplify, or run custom instructions.",
		features: [
			"Polish cards mid-review",
			"Polish + fill in the Add Flashcard modal",
			"Per-preset auto-apply or preview",
			"Hotkey support for each preset (review only)",
			"Optional source-note and related-card context per preset",
		],
		icon: "wand-2",
		requiresPro: false,
	},
	settingsPanel: createCardAISettingsPanel({
		bucketKey: "cardPolish",
		builtins: CARD_POLISH_BUILTINS,
		description:
			"Polish presets work in review and in the Add Flashcard modal.",
	}),
	activate: (ctx) => {
		const plugin = new CardPolishPlugin(ctx);
		plugin.activate();
		return () => plugin.deactivate();
	},
};
