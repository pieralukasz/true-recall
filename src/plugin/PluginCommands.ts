import type TrueRecallPlugin from "../main";

export function registerCommands(plugin: TrueRecallPlugin): void {
	plugin.addCommand({
		id: "open-flashcard-panel",
		name: "Open flashcard panel",
		callback: () => void plugin.activateView(),
	});

	plugin.addCommand({
		id: "generate-flashcards",
		name: "Generate flashcards for current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.activateView();
				}
				return true;
			}
			return false;
		},
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
		id: "show-projects",
		name: "Open projects panel",
		callback: () => void plugin.showProjects(),
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
		id: "open-browser",
		name: "Open card browser",
		callback: () => void plugin.showBrowser(),
	});

	plugin.addCommand({
		id: "open-fsrs-simulator",
		name: "Open FSRS simulator",
		callback: () => void plugin.openSimulator(),
	});

	plugin.addCommand({
		id: "open-orphaned-cards",
		name: "Open orphaned cards panel",
		callback: () => void plugin.openOrphanedCardsView(),
	});

	plugin.addCommand({
		id: "create-backup",
		name: "Create database backup",
		callback: () => void plugin.createManualBackup(),
	});

	plugin.addCommand({
		id: "sync-cloud",
		name: "Sync cloud data",
		callback: () => void plugin.syncCloud(),
	});

	plugin.addCommand({
		id: "add-flashcard-uid",
		name: "Add flashcard UID to current note",
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
			// Only show command if undo is available
			if (!plugin.undoService?.canUndo()) {
				return false;
			}
			if (!checking) {
				void plugin.undoService.undo();
			}
			return true;
		},
	});
}
