import type { PluginManifest } from "../types";

export { AnkiExportModal } from "./AnkiExportModal";
export { AnkiImportModal } from "./AnkiImportModal";

export const ankiImportExportManifest: PluginManifest = {
	info: {
		id: "anki-import-export",
		name: "AI Anki Import",
		description:
			"AI-powered Anki import with automatic deck classification, field cleanup, and note type mapping.",
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
