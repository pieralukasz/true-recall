/**
 * Plugin Commands
 * All command registrations for the Episteme plugin
 */
import type EpistemePlugin from "../main";
import { FLASHCARD_CONFIG } from "../constants";

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
			if (
				file &&
				file.extension === "md" &&
				!file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
			) {
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

	// Show notes ready to harvest
	plugin.addCommand({
		id: "show-ready-to-harvest",
		name: "Show notes ready to harvest",
		callback: () => void plugin.showReadyToHarvest(),
	});

	// Sync source notes with vault
	plugin.addCommand({
		id: "sync-source-notes",
		name: "Sync source notes with vault",
		callback: () => void plugin.syncSourceNotes(),
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
}
