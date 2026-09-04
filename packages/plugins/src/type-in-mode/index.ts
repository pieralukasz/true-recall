import type { PluginManifest } from "../types";
import { TypeInModeSettingsPanel } from "./settings-panel";

export const typeInModeManifest: PluginManifest = {
	info: {
		id: "type-in-mode",
		name: "Typed Answers",
		description:
			"Test your recall by typing answers instead of just revealing them. AI grades your response semantically.",
		features: [
			"Type your answer before revealing",
			"AI semantic grading with detailed feedback",
			"Toggle the mode during review with the T shortcut",
		],
		icon: "keyboard",
		tier: "pro",
	},
	settingsPanel: TypeInModeSettingsPanel,
};
