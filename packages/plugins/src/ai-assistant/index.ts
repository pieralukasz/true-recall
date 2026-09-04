import type { PluginManifest } from "../types";
import { AIWorkspaceSettingsPanel } from "./AIWorkspaceSettingsPanel";
import { AiAssistantPlugin } from "./AiAssistantPlugin";

let runtime: AiAssistantPlugin | undefined;

export const aiAssistantManifest: PluginManifest = {
	info: {
		id: "ai-assistant",
		name: "AI Workspace",
		description:
			"One workspace for research, generating new flashcards, and improving existing cards. All workflows share the same task queue and recoverable Inbox.",
		features: [
			"Ask questions and research concepts with note or card context",
			"Generate cards from notes and selections",
			"Rewrite, complete, or split existing cards",
			"Shared async task queue and AI Inbox",
		],
		icon: "sparkles",
		tier: "byok",
	},
	settingsPanel: AIWorkspaceSettingsPanel,
	toolbarButtonIds: ["ask-ai"],
	activate: (ctx) => {
		const plugin = new AiAssistantPlugin(ctx);
		runtime = plugin;
		plugin.activate();
		return () => {
			plugin.deactivate();
			if (runtime === plugin) runtime = undefined;
		};
	},
	sync: () => runtime?.syncPresetCommands(),
};
