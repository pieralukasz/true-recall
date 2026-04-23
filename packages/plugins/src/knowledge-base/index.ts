import type { PluginManifest } from "../types";
import { KnowledgeBaseSettingsPanel } from "./settings-panel";

export const knowledgeBaseManifest: PluginManifest = {
	info: {
		id: "knowledge-base",
		name: "Knowledge Base",
		description:
			"Chat with your notes using RAG-powered AI. Index your vault, ask questions, and get answers grounded in your own knowledge.",
		features: [
			"Semantic search across your vault",
			"AI chat grounded in your notes",
			"Automatic indexing on file changes",
			"Folder include/exclude filters",
		],
		icon: "library",
		tier: "pro",
	},
	settingsPanel: KnowledgeBaseSettingsPanel,
};
