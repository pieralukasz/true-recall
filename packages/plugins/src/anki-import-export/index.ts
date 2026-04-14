import type { PluginManifest } from "../types";

export { AnkiExportModal } from "./AnkiExportModal";
export { AnkiImportModal } from "./AnkiImportModal";

export const ankiImportExportManifest: PluginManifest = {
	info: {
		id: "anki-import-export",
		name: "Anki Import/Export",
		description:
			"Import Anki decks (.apkg) and export your flashcards to Anki format.",
		features: [
			"Import .apkg files with scheduling data",
			"AI-assisted deck classification and field cleanup",
			"Export to .apkg with media",
		],
		icon: "import",
		requiresPro: true,
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
