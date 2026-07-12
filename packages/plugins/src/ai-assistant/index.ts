import type { PluginManifest } from "../types";
import { AiAssistantPlugin } from "./AiAssistantPlugin";
import { AssistantSettingsPanel } from "./AssistantSettingsPanel";

export const aiAssistantManifest: PluginManifest = {
	info: {
		id: "ai-assistant",
		name: "AI Assistant",
		description:
			"Mark a knowledge gap during review and let AI research it — new cards, filled answers, note sections, diagrams and images arrive as drafts in the AI Inbox.",
		features: [
			"Ask AI from a selection bubble in review",
			"Async task queue — review is never blocked",
			"Draft proposals approved in the AI Inbox",
			"Web-grounded research with source citations",
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
