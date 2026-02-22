import type TrueRecallPlugin from "../main";

export function registerCommands(plugin: TrueRecallPlugin): void {
	plugin.addCommand({
		id: "open-flashcard-panel",
		name: "Open flashcard panel",
		callback: () => void plugin.activateView(),
	});

	plugin.addCommand({
		id: "review-current-note",
		name: "Review flashcards from current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.reviewCurrentNote();
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "review-todays-cards",
		name: "Review today's new cards",
		callback: () => void plugin.reviewTodaysCards(),
	});

	plugin.addCommand({
		id: "open-statistics",
		name: "Open statistics panel",
		callback: () => void plugin.openStatsView(),
	});

	plugin.addCommand({
		id: "add-to-project",
		name: "Add current note to project",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.addCurrentNoteToProject();
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "open-fsrs-simulator",
		name: "Open FSRS simulator",
		callback: () => void plugin.openSimulator(),
	});

	plugin.addCommand({
		id: "create-backup",
		name: "Create database backup",
		callback: () => void plugin.createManualBackup(),
	});

	// Cloud sync - coming soon
	// plugin.addCommand({
	// 	id: "sync-cloud",
	// 	name: "Sync cloud data",
	// 	callback: () => void plugin.syncCloud(),
	// });

	plugin.addCommand({
		id: "add-flashcard-uid",
		name: "Add flashcard uid to current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.addFlashcardUidToCurrentNote();
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "undo-flashcard-action",
		name: "Undo last flashcard action",
		checkCallback: (checking) => {
			if (!plugin.undoService?.canUndo()) {
				return false;
			}
			if (!checking) {
				void plugin.undoService.undo();
			}
			return true;
		},
	});

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

	plugin.addCommand({
		id: "export-csv",
		name: "Export as CSV/TSV",
		callback: () => void plugin.exportCsv(),
	});

	plugin.addCommand({
		id: "set-fsrs-preset",
		name: "Set FSRS preset for current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.setFsrsPresetForCurrentNote();
				}
				return true;
			}
			return false;
		},
	});
}
