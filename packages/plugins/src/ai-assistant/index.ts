import type { PluginManifest } from "../types";
import { AiAssistantPlugin } from "./AiAssistantPlugin";
import { AssistantSettingsPanel } from "./AssistantSettingsPanel";

export const aiAssistantManifest: PluginManifest = {
	info: {
		id: "ai-assistant",
		name: "Assistant",
		description:
			"The AI workspace itself: ask questions, research concepts, and run any saved preset. Generator and Card Polish presets appear inside it, so turning this off hides every AI surface.",
		features: [
			"Docked Ask AI panel that follows the card you are reviewing",
			"Anchored preset list for one-click saved instructions",
			"Context from the current note, selection, or flashcard",
			"Async task queue — review is never blocked",
			"Shared AI Inbox with Generator and Card Polish",
		],
		icon: "sparkles",
		tier: "byok",
	},
	settingsPanel: AssistantSettingsPanel,
	toolbarButtonIds: ["ask-ai"],
	activate: (ctx) => {
		const plugin = new AiAssistantPlugin(ctx);
		plugin.activate();
		return () => plugin.deactivate();
	},
};
