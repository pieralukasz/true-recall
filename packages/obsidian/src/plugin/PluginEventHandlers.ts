import { FlashcardPanelView } from "@true-recall/obsidian/views/panel/FlashcardPanelView";
import type { DeletionHandlerService } from "@true-recall/core/flashcard/deletion-handler.service";
import { VIEW_TYPE_FLASHCARD_PANEL, VIEW_TYPE_REVIEW } from "@true-recall/core/constants";
import { ItemView, Notice, normalizePath, TFile, TFolder } from "obsidian";
import type TrueRecallPlugin from "../main";
import {
	editSelectionAsFlashcard,
	generateFlashcardsFromSelection,
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
						.setTitle("Create project from this note")
						.setIcon("folder-plus")
						.onClick(async () => {
							const { NamePromptModal } = await import(
								"@true-recall/obsidian/modals/study/NamePromptModal"
							);
							const modal = new NamePromptModal(plugin.app, file.basename);
							const result = await modal.openAndWait();
							if (result.cancelled) return;

							const name = result.name;
							const folderPath = file.parent?.path ?? "";
							const projectPath = normalizePath(
								folderPath ? `${folderPath}/${name}.md` : `${name}.md`,
							);

							if (plugin.app.vault.getAbstractFileByPath(projectPath)) {
								new Notice(`A note already exists at "${projectPath}".`);
								return;
							}

							await plugin.app.vault.create(projectPath, "");
							const frontmatterService =
								plugin.flashcardManager.getFrontmatterService();
							await frontmatterService.addParent(file.path, name);
							new Notice(`Created project "${name}"`);
						});
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
								const content = ["---", "include: folder", "---", ""].join(
									"\n",
								);
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
						.onClick(() => void generateFlashcardsFromSelection(plugin, text));
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

/** Respects review follow mode and panel interactions */
function updatePanelView(plugin: TrueRecallPlugin, file: TFile | null): void {
	const { workspace } = plugin.app;
	const activeLeaf = workspace.activeLeaf;
	const activeView = workspace.getActiveViewOfType(ItemView);
	const isReviewViewActive = activeView?.getViewType() === VIEW_TYPE_REVIEW;
	const isPanelActive = activeView?.getViewType() === VIEW_TYPE_FLASHCARD_PANEL;

	// Only react to main editor area leaf changes
	// Sidebar clicks (stats, etc.) should not affect the panel
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
				void deletionHandler.handleFileDeletion(file.path);
			}
		}),
	);
}
