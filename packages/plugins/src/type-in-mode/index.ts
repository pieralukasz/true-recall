import type { PluginManifest } from "../types";
import { TypeInModeSettingsPanel } from "./settings-panel";

export const typeInModeManifest: PluginManifest = {
	info: {
		id: "type-in-mode",
		name: "Type-in Mode",
		description:
			"Test your recall by typing answers instead of just revealing them. AI grades your response semantically.",
		features: [
			"Type your answer before revealing",
			"AI semantic grading with detailed feedback",
			"Diff view showing exact differences",
			"Works with all card types",
		],
		icon: "keyboard",
		requiresPro: true,
	},
	settingsPanel: TypeInModeSettingsPanel,
};
