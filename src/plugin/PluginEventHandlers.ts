/**
 * Plugin Event Handlers
 * Event registrations for file and workspace events
 * Projects are read from frontmatter (source of truth)
 */
import { TFile } from "obsidian";
import type EpistemePlugin from "../main";
import { FlashcardPanelView } from "../ui/flashcard-panel/FlashcardPanelView";
import { VIEW_TYPE_FLASHCARD_PANEL } from "../constants";

/**
 * Register workspace and vault event handlers
 */
export function registerEventHandlers(plugin: EpistemePlugin): void {
	// File context menu for custom review
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			if (file instanceof TFile && file.extension === "md") {
				// Don't show on flashcard files themselves
				if (plugin.flashcardManager.isFlashcardFile(file)) return;

				menu.addItem((item) => {
					item.setTitle("Review flashcards from this note")
						.setIcon("brain")
						.onClick(() => void plugin.reviewNoteFlashcards(file));
				});

				menu.addItem((item) => {
					item.setTitle("Create project from this note")
						.setIcon("folder-plus")
						.onClick(() => void plugin.createProjectFromNote(file));
				});
			}
		})
	);

	// Listen for active file changes
	plugin.registerEvent(
		plugin.app.workspace.on("file-open", (file) => {
			updatePanelView(plugin, file);
		})
	);

	// Also listen for active leaf changes
	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", () => {
			const file = plugin.app.workspace.getActiveFile();
			updatePanelView(plugin, file);
		})
	);
}

/**
 * Update the panel view with current file
 */
function updatePanelView(plugin: EpistemePlugin, file: TFile | null): void {
	const leaves = plugin.app.workspace.getLeavesOfType(
		VIEW_TYPE_FLASHCARD_PANEL
	);
	leaves.forEach((leaf) => {
		const view = leaf.view;
		if (view instanceof FlashcardPanelView) {
			void view.handleFileChange(file);
		}
	});
}
