import { ItemView, normalizePath, TFile, TFolder } from "obsidian";

import {
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@true-recall/core/constants";
import type { DeletionHandlerService } from "@true-recall/core/flashcard/lifecycle/deletion-handler.service";

import { FlashcardPanelView } from "@true-recall/obsidian/views/panel/FlashcardPanelView";

import type TrueRecallPlugin from "../main";
import {
	editSelectionAsFlashcard,
	generateWithPreset,
	hasApiKey,
	quickAddFlashcardFromSelection,
} from "./SelectionActions";

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
						.setTitle("Open flashcard panel")
						.setIcon("book-text")
						.onClick(() => void plugin.activateView());
				});

				menu.addItem((item) => {
					item
						.setTitle("Toggle note review")
						.setIcon("book-open-check")
						.onClick(() => void plugin.toggleNoteReview(file));
				});

				menu.addItem((item) => {
					item
						.setTitle("Convert to project")
						.setIcon("folder-plus")
						.onClick(() =>
							plugin.projectManagement.convertToProject(file.path),
						);
				});
			}
		}),
	);

	// Folder context menu — create project/folder note
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			if (file instanceof TFolder) {
				const folderName = file.name;
				const notePath = normalizePath(`${file.path}/${folderName}.md`);

				if (!plugin.app.vault.getAbstractFileByPath(notePath)) {
					menu.addItem((item) => {
						item
							.setTitle("Create project note")
							.setIcon("folder-plus")
							.onClick(async () => {
								const content = ["---", "project: true", "---", ""].join("\n");
								await plugin.app.vault.create(notePath, content);
								await plugin.app.workspace.openLinkText(notePath, "", false);
							});
					});
				}
			}
		}),
	);

	// Editor context menu (right-click / long-press) — flashcard from selection
	plugin.registerEvent(
		plugin.app.workspace.on("editor-menu", (menu, editor) => {
			const selection = editor.getSelection();
			if (!selection || selection.trim().length < 3) return;

			const text = selection.trim();

			if (hasApiKey(plugin)) {
				menu.addItem((item) => {
					item
						.setTitle("Generate flashcards")
						.setIcon("sparkles")
						.onClick(
							() =>
								void generateWithPreset(
									plugin,
									plugin.settings.defaultGenerationPresetId,
									text,
								),
						);
				});
			}

			menu.addItem((item) => {
				item
					.setTitle("Quick add flashcard")
					.setIcon("zap")
					.onClick(() => void quickAddFlashcardFromSelection(plugin, text));
			});

			menu.addItem((item) => {
				item
					.setTitle("Edit as flashcard")
					.setIcon("pencil")
					.onClick(() => editSelectionAsFlashcard(plugin, text));
			});
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

const VIEW_CONTEXT_MAP: Record<string, string> = {
	[VIEW_TYPE_DASHBOARD]: "Dashboard",
	[VIEW_TYPE_CARD_BROWSER]: "Card Browser",
	[VIEW_TYPE_STATS]: "Statistics",
	[VIEW_TYPE_REVIEW]: "Review",
	[VIEW_TYPE_SIMULATOR]: "Simulator",
};

/** Respects review follow mode and panel interactions */
function updatePanelView(plugin: TrueRecallPlugin, file: TFile | null): void {
	const { workspace } = plugin.app;
	const activeView = workspace.getActiveViewOfType(ItemView);
	const activeViewType = activeView?.getViewType() ?? "";
	const isReviewViewActive = activeViewType === VIEW_TYPE_REVIEW;
	const isPanelActive = activeViewType === VIEW_TYPE_FLASHCARD_PANEL;

	// Detect if a True Recall view is active (Dashboard, Browser, Stats, etc.)
	const viewContext = VIEW_CONTEXT_MAP[activeViewType] ?? null;

	// Only react to main editor area leaf changes
	// Review view and panel itself get special handling below
	const isMainArea = activeView?.leaf?.getContainer() === workspace.rootSplit;
	if (!isMainArea && !isReviewViewActive && !isPanelActive) {
		// Non-main-area TR view: update context label only
		if (viewContext) {
			plugin.store
				?.getState()
				.panel.setState({ activeViewContext: viewContext });
		}
		return;
	}

	const leaves = workspace.getLeavesOfType(VIEW_TYPE_FLASHCARD_PANEL);
	leaves.forEach((leaf) => {
		const view = leaf.view;
		if (view instanceof FlashcardPanelView) {
			// Clear view context when navigating to a file or main area view
			plugin.store?.getState().panel.setState({
				activeViewContext: viewContext,
			});

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
				void deletionHandler.handleFileDeletion(file.path);
			}
		}),
	);
}
