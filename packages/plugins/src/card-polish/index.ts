import type { PluginManifest } from "../types";
import { CardPolishPlugin } from "./CardPolishPlugin";
import { CardPolishSettingsPanel } from "./settings-panel";

export const cardPolishManifest: PluginManifest = {
	info: {
		id: "card-polish",
		name: "Card Polish",
		description:
			"Transform flashcards during review — fix formatting, simplify, or run custom instructions.",
		features: [
			"Fix broken markdown tables mid-review",
			"Per-preset auto-apply or preview",
			"Hotkey support for each preset",
			"Custom freeform prompts",
		],
		icon: "wand-2",
		requiresPro: false,
	},
	settingsPanel: CardPolishSettingsPanel,
	activate: (ctx) => {
		const plugin = new CardPolishPlugin(ctx);
		plugin.activate();
		return () => plugin.deactivate();
	},
};
