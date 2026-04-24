import type { PluginManifest } from "../types";

export { AnkiExportModal } from "./AnkiExportModal";
export { AnkiImportModal } from "./AnkiImportModal";

export const ankiImportExportManifest: PluginManifest = {
	info: {
		id: "anki-import-export",
		name: "AI Anki Import",
		description:
			"Import .apkg decks with AI-assisted deck classification, field cleanup, and automatic note type mapping. Also exports your True Recall cards back to Anki while preserving FSRS scheduling data.",
		features: [
			"AI-assisted deck classification and field cleanup",
			"Automatic note type mapping",
			"Import .apkg files with scheduling data",
		],
		icon: "import",
		tier: "pro",
	},
	activate: (ctx) => {
		const { obsidianPlugin: plugin } = ctx;

		plugin.addCommand({
			id: "import-anki",
			name: "Import Anki deck (.apkg)",
			callback: () => void plugin.importAnki(),
		});

		plugin.addCommand({
			id: "export-anki",
			name: "Export to Anki (.apkg)",
			callback: () => void plugin.exportAnki(),
		});
	},
};
