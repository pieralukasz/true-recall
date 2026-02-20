import { ItemView, TFile } from "obsidian";
import { VIEW_TYPE_FLASHCARD_PANEL, VIEW_TYPE_REVIEW } from "@shared/constants";
import type TrueRecallPlugin from "../main";
import type { DeletionHandlerService } from "@features/study/services/flashcard/deletion-handler.service";
import { FlashcardPanelView } from "@features/study/ui/panel/FlashcardPanelView";

export function registerEventHandlers(plugin: TrueRecallPlugin): void {
	// Single file context menu
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			if (file instanceof TFile && file.extension === "md") {
				menu.addItem((item) => {
					item
						.setTitle("Review flashcards from this note")
						.setIcon("brain")
						.onClick(() => void plugin.reviewNoteFlashcards(file));
				});

				menu.addItem((item) => {
					item
						.setTitle("Create project from this note")
						.setIcon("folder-plus")
						.onClick(() => void plugin.createProjectFromNote(file));
				});

				menu.addItem((item) => {
					item
						.setTitle("Open flashcard panel")
						.setIcon("book-text")
						.onClick(() => void plugin.activateView());
				});
			}
		}),
	);

	plugin.registerEvent(
		plugin.app.workspace.on("file-open", (file) => {
			updatePanelView(plugin, file);
		}),
	);

	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", () => {
			const file = plugin.app.workspace.getActiveFile();
			updatePanelView(plugin, file);
		}),
	);
}

/** Respects review follow mode and panel interactions */
function updatePanelView(plugin: TrueRecallPlugin, file: TFile | null): void {
	const { workspace } = plugin.app;
	const activeLeaf = workspace.activeLeaf;
	const activeView = workspace.getActiveViewOfType(ItemView);
	const isReviewViewActive = activeView?.getViewType() === VIEW_TYPE_REVIEW;
	const isPanelActive = activeView?.getViewType() === VIEW_TYPE_FLASHCARD_PANEL;

	// Only react to main editor area leaf changes
	// Sidebar clicks (stats, note hub, etc.) should not affect the panel
	// Review view and panel itself get special handling below
	const isMainArea = activeLeaf?.getContainer() === workspace.rootSplit;
	if (!isMainArea && !isReviewViewActive && !isPanelActive) {
		return;
	}

	const leaves = workspace.getLeavesOfType(VIEW_TYPE_FLASHCARD_PANEL);
	leaves.forEach((leaf) => {
		const view = leaf.view;
		if (view instanceof FlashcardPanelView) {
			if (isReviewViewActive && view.isFollowingReview()) {
				return;
			}

			if (isPanelActive) {
				return;
			}

			// When returning to review view, re-sync panel with the current review card
			// (follow state was cleared when user navigated away, subscription won't fire
			// because the review store hasn't changed)
			if (isReviewViewActive) {
				const review = plugin.store?.getState()?.review;
				if (review?.isActive) {
					const currentCard = review.getCurrentCard();
					const currentPath = currentCard?.sourceNotePath ?? null;
					view.syncWithReviewState(currentPath, true);
					return;
				}
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
	deletionHandler: DeletionHandlerService,
): void {
	plugin.registerEvent(
		plugin.app.vault.on("delete", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				void deletionHandler.handleFileDeletion(file);
			}
		}),
	);
}
