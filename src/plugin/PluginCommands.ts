import type TrueRecallPlugin from "../main";

export function registerCommands(plugin: TrueRecallPlugin): void {
	plugin.addCommand({
		id: "open-flashcard-panel",
		name: "Open flashcard panel",
		callback: () => void plugin.activateView(),
	});

	plugin.addCommand({
		id: "start-review",
		name: "Start review session",
		callback: () => void plugin.startReviewSession(),
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
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
		name: "Open FSRS simulator",
		callback: () => void plugin.openSimulator(),
	});

	plugin.addCommand({
		id: "open-orphaned-cards",
		name: "Open orphaned cards panel",
		callback: () => void plugin.openOrphanedCardsView(),
	});

	plugin.addCommand({
		id: "open-note-hub",
		name: "Open note hub",
		callback: () => void plugin.openNoteHub(),
	});

	plugin.addCommand({
		id: "open-card-browser",
		name: "Open card browser",
		callback: () => void plugin.openCardBrowser(),
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
		id: "merge-zettel-notes",
		name: "Merge zettel notes into thinking note",
		callback: () => void plugin.mergeNotes(),
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
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- CSV/TSV is an acronym
		name: "Export as CSV/TSV",
		callback: () => void plugin.exportCsv(),
	});

	plugin.addCommand({
		id: "set-fsrs-preset",
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
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
