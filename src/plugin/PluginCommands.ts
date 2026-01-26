/**
 * Plugin Commands
 * All command registrations for the Episteme plugin
 */
import type EpistemePlugin from "../main";
import { VIEW_TYPE_NOTES_WITHOUT_PROJECTS } from "../constants";
import { activateView } from "./ViewActivator";

/**
 * Register all plugin commands
 */
export function registerCommands(plugin: EpistemePlugin): void {
	// Open flashcard panel
	plugin.addCommand({
		id: "open-flashcard-panel",
		name: "Open flashcard panel",
		callback: () => void plugin.activateView(),
	});

	// Generate flashcards for current note
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

	// Start review session
	plugin.addCommand({
		id: "start-review",
		name: "Start review session",
		callback: () => void plugin.startReviewSession(),
	});

	// Review flashcards from current note
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

	// Review today's new cards
	plugin.addCommand({
		id: "review-todays-cards",
		name: "Review today's new cards",
		callback: () => void plugin.reviewTodaysCards(),
	});

	// Open statistics panel
	plugin.addCommand({
		id: "open-statistics",
		name: "Open statistics panel",
		callback: () => void plugin.openStatsView(),
	});

	// Show notes missing flashcards
	plugin.addCommand({
		id: "show-missing-flashcards",
		name: "Show notes missing flashcards",
		callback: () => void plugin.showMissingFlashcards(),
	});

	// Show orphaned cards
	plugin.addCommand({
		id: "show-orphaned-cards",
		name: "Show orphaned cards",
		callback: () => void plugin.showOrphanedCards(),
	});

	// Show projects panel
	plugin.addCommand({
		id: "show-projects",
		name: "Open projects panel",
		callback: () => void plugin.showProjects(),
	});

	// Add current note to project
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

	// Open card browser
	plugin.addCommand({
		id: "open-browser",
		name: "Open card browser",
		callback: () => void plugin.showBrowser(),
	});

	// Open notes without projects
	plugin.addCommand({
		id: "open-notes-without-projects",
		name: "Open notes without projects",
		callback: () => {
			void activateView(plugin.app, VIEW_TYPE_NOTES_WITHOUT_PROJECTS);
		},
	});

	// Open FSRS simulator
	plugin.addCommand({
		id: "open-fsrs-simulator",
		name: "Open FSRS simulator",
		callback: () => void plugin.openSimulator(),
	});

	// Create database backup
	plugin.addCommand({
		id: "create-backup",
		name: "Create database backup",
		callback: () => void plugin.createManualBackup(),
	});

	// Sync cloud data
	plugin.addCommand({
		id: "sync-cloud",
		name: "Sync cloud data",
		callback: () => void plugin.syncCloud(),
	});

	// Add flashcard UID to current note
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
}
