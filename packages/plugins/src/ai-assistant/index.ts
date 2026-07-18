import type { PluginManifest } from "../types";
import { AiAssistantPlugin } from "./AiAssistantPlugin";
import { AssistantSettingsPanel } from "./AssistantSettingsPanel";

export const aiAssistantManifest: PluginManifest = {
	info: {
		id: "ai-assistant",
		name: "AI Assistant",
		description:
			"Create and modify flashcards from selections, review, and the flashcard editor through one draft-and-approve workflow.",
		features: [
			"Create cards from selected text with existing generation presets",
			"Modify saved cards and open drafts with Card Polish presets",
			"Async task queue — review is never blocked",
			"Review proposals inline or later in the AI Inbox",
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
