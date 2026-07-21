import type { PluginManifest } from "../types";
import { AiAssistantPlugin } from "./AiAssistantPlugin";
import { AssistantSettingsPanel } from "./AssistantSettingsPanel";

export const aiAssistantManifest: PluginManifest = {
	info: {
		id: "ai-assistant",
		name: "Assistant",
		description:
			"Ask questions, research concepts, and coordinate AI work across your notes and flashcards.",
		features: [
			"Free-form questions and research",
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
