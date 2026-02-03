import { ItemView, TFile } from "obsidian";
import type TrueRecallPlugin from "../main";
import { FlashcardPanelView } from "../ui/flashcard-panel/FlashcardPanelView";
import { VIEW_TYPE_FLASHCARD_PANEL, VIEW_TYPE_REVIEW } from "../constants";
import type { DeletionHandlerService } from "../services/flashcard/deletion-handler.service";

export function registerEventHandlers(plugin: TrueRecallPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			if (file instanceof TFile && file.extension === "md") {

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

				menu.addItem((item) => {
					item.setTitle("Open flashcard panel")
						.setIcon("book-text")
						.onClick(() => void plugin.activateView());
				});
			}
		})
	);

	plugin.registerEvent(
		plugin.app.workspace.on("file-open", (file) => {
			updatePanelView(plugin, file);
		})
	);

	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", () => {
			const file = plugin.app.workspace.getActiveFile();
			updatePanelView(plugin, file);
		})
	);
}

/** Respects review follow mode and panel interactions */
function updatePanelView(plugin: TrueRecallPlugin, file: TFile | null): void {
	const activeView = plugin.app.workspace.getActiveViewOfType(ItemView);
	const isReviewViewActive = activeView?.getViewType() === VIEW_TYPE_REVIEW;
	const isPanelActive = activeView?.getViewType() === VIEW_TYPE_FLASHCARD_PANEL;

	const leaves = plugin.app.workspace.getLeavesOfType(
		VIEW_TYPE_FLASHCARD_PANEL
	);
	leaves.forEach((leaf) => {
		const view = leaf.view;
		if (view instanceof FlashcardPanelView) {
			if (isReviewViewActive && view.isFollowingReview()) {
				return;
			}

			if (isPanelActive) {
				return;
			}

	
			if (file && !isReviewViewActive && view.isFollowingReview()) {
				view.clearReviewFollowState();
			}

			void view.handleFileChange(file);
		}
	});
}

/**
 * Called BEFORE FrontmatterIndexService updates its index,
 * so we can still retrieve the flashcard_uid from the deleted file
 */
export function registerDeletionHandler(
	plugin: TrueRecallPlugin,
	deletionHandler: DeletionHandlerService
): void {
	plugin.registerEvent(
		plugin.app.vault.on("delete", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				void deletionHandler.handleFileDeletion(file);
			}
		})
	);
}
