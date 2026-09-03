import { notify } from "@true-recall/obsidian/services/notification.service";
import { capabilities, isDesktop } from "@true-recall/obsidian/utils/platform";
import { ReviewView } from "@true-recall/obsidian/views/review/ReviewView";

import type TrueRecallPlugin from "../main";
import { countAppliedChanges } from "./CrossDeviceSyncCoordinator";
import { isPluginEnabled } from "./plugin-utils";
import {
	editSelectionAsFlashcard,
	generateWithPreset,
	generateWithPresetGlobal,
	hasApiKey,
	quickAddFlashcardFromSelection,
	quickAddFlashcardGlobal,
} from "./SelectionActions";

export function registerCommands(plugin: TrueRecallPlugin): void {
	plugin.addCommand({
		id: "open-flashcard-panel",
		name: "Show flashcards for current note",
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
		id: "toggle-r-mode",
		name: "Toggle r-mode (retrievability sessions)",
		callback: () => void plugin.toggleRMode(),
	});

	plugin.addCommand({
		id: "open-dashboard",
		name: "Open dashboard",
		callback: () => void plugin.openDashboard(),
	});

	plugin.addCommand({
		id: "toggle-tab-bar",
		name: "Toggle tab bar",
		checkCallback: (checking) => {
			if (!isDesktop()) return false;
			if (!checking) void plugin.toggleTabBar();
			return true;
		},
	});

	plugin.addCommand({
		id: "open-card-browser",
		name: "Open card browser",
		checkCallback: (checking) => {
			if (!capabilities.canUseCardBrowser()) return false;
			if (!checking) void plugin.openCardBrowser();
			return true;
		},
	});

	plugin.addCommand({
		id: "open-fsrs-simulator",
		name: "Open FSRS simulator",
		checkCallback: (checking) => {
			if (!isDesktop()) return false;
			if (!checking) void plugin.openSimulator();
			return true;
		},
	});

	plugin.addCommand({
		id: "open-stats",
		name: "Open statistics",
		callback: () => void plugin.openStats(),
	});

	plugin.addCommand({
		id: "manage-note-types",
		name: "Manage note types",
		callback: () => plugin.openCardTypesEditor(),
	});

	plugin.addCommand({
		id: "add-flashcards",
		name: "Import flashcards",
		callback: () => plugin.openImportStudio(),
	});

	plugin.addCommand({
		id: "add-flashcard",
		name: "Add flashcard to current note",
		callback: () => plugin.openQuickNoteEditor(),
	});

	plugin.addCommand({
		id: "create-image-occlusion-card",
		name: "Create image occlusion card",
		checkCallback: (checking) => {
			if (!isPluginEnabled(plugin.settings, "image-occlusion")) return false;
			if (!checking) void plugin.openImageOcclusionEditorForActiveNote();
			return true;
		},
	});

	plugin.addCommand({
		id: "create-backup",
		name: "Create database backup",
		callback: () => void plugin.createManualBackup(),
	});

	plugin.addCommand({
		id: "sync-devices-now",
		name: "Sync devices now",
		checkCallback: (checking) => {
			if (
				plugin.settings.syncMode !== "shared-vault" ||
				!plugin.syncCoordinator
			) {
				return false;
			}
			if (!checking) {
				void plugin.syncCoordinator.syncNow("manual").then((result) => {
					if (!result) {
						notify().warning("Device sync failed. See console for details.");
						return;
					}
					if (result.errors.length > 0) {
						notify().warning(
							`Sync completed with ${result.errors.length} error(s).`,
						);
						return;
					}
					const applied = countAppliedChanges(result);
					notify().info(
						applied > 0
							? `Synced ${result.cardsApplied} cards and ${result.reviewLogsApplied} reviews.`
							: "Everything is up to date.",
					);
				});
			}
			return true;
		},
	});

	plugin.addCommand({
		id: "sync-cloud-now",
		name: "Sync cloud now",
		checkCallback: (checking) => {
			if (plugin.settings.syncMode !== "cloud" || !plugin.cloudSyncManager)
				return false;
			if (!checking) {
				void plugin.cloudSyncManager.coordinator
					.syncNow("manual")
					.then((result) => {
						if (!result || result.errors.length) {
							notify().warning(
								result?.errors[0] ??
									"Cloud Sync failed. See console for details.",
							);
							return;
						}
						notify().info(
							result.pulled + result.pushed > 0
								? `Cloud Sync: ${result.pulled} pulled, ${result.pushed} pushed.`
								: "Everything is up to date.",
						);
					});
			}
			return true;
		},
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
		id: "toggle-note-review",
		name: "Toggle note review",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.toggleNoteReview(file);
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
			const reviewView = plugin.app.workspace.getActiveViewOfType(ReviewView);
			if (reviewView) {
				if (!reviewView.canUndoSessionAction()) return false;
				if (!checking) void reviewView.undoSessionAction();
				return true;
			}
			if (!plugin.commandService?.canUndo()) return false;
			if (!checking) {
				void plugin.commandService.undo();
			}
			return true;
		},
	});

	plugin.addCommand({
		id: "fact-check-current-card",
		name: "Fact check current card",
		checkCallback: (checking) => {
			const reviewView = plugin.app.workspace.getActiveViewOfType(ReviewView);
			if (!reviewView?.canFactCheckCurrentCard()) return false;
			if (!checking) reviewView.factCheckCurrentCard();
			return true;
		},
	});

	plugin.addCommand({
		id: "redo-flashcard-action",
		name: "Redo last undone action",
		checkCallback: (checking) => {
			const reviewView = plugin.app.workspace.getActiveViewOfType(ReviewView);
			if (reviewView) {
				if (!reviewView.canRedoSessionAction()) return false;
				if (!checking) void reviewView.redoSessionAction();
				return true;
			}
			if (!plugin.commandService?.canRedo()) return false;
			if (!checking) {
				void plugin.commandService.redo();
			}
			return true;
		},
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

	plugin.addCommand({
		id: "archive-current-note",
		name: "Archive current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (plugin.hierarchyService.isNoteArchived(file.path)) return false;
				if (!checking) {
					void plugin.flashcardManager
						.getFrontmatterService()
						.setArchive(file.path, true);
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "unarchive-current-note",
		name: "Unarchive current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!plugin.hierarchyService.isNoteArchived(file.path)) return false;
				if (!checking) {
					void plugin.flashcardManager
						.getFrontmatterService()
						.setArchive(file.path, false);
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "open-assistant-workspace",
		name: "Open ask AI panel",
		checkCallback: (checking) => {
			if (!isDesktop()) return false;
			if (!isPluginEnabled(plugin.settings, "ai-assistant")) return false;
			if (!checking) void plugin.openAssistantWorkspace();
			return true;
		},
	});

	plugin.addCommand({
		id: "open-assistant-inbox",
		name: "Open AI assistant inbox",
		checkCallback: (checking) => {
			if (!isDesktop()) return false;
			if (!isPluginEnabled(plugin.settings, "ai-assistant")) return false;
			if (!checking) void plugin.openAssistantInbox();
			return true;
		},
	});

	plugin.addCommand({
		id: "generate-flashcards-from-selection",
		name: "Generate flashcards from selection",
		editorCheckCallback: (checking, editor) => {
			if (!isPluginEnabled(plugin.settings, "ai-generation")) return false;
			const selection = editor.getSelection();
			if (!selection || selection.trim().length < 3) return false;
			if (!hasApiKey(plugin)) return false;
			if (checking) return true;
			void generateWithPreset(
				plugin,
				plugin.settings.defaultGenerationPresetId,
				selection.trim(),
			);
			return true;
		},
	});

	plugin.addCommand({
		id: "quick-add-flashcard-from-selection",
		name: "Quick add flashcard from selection",
		editorCheckCallback: (checking, editor) => {
			const selection = editor.getSelection();
			if (!selection || selection.trim().length < 3) return false;
			if (checking) return true;
			void quickAddFlashcardFromSelection(plugin, selection.trim());
			return true;
		},
	});

	plugin.addCommand({
		id: "edit-selection-as-flashcard",
		name: "Edit selection as flashcard",
		editorCheckCallback: (checking, editor) => {
			const selection = editor.getSelection();
			if (!selection || selection.trim().length < 3) return false;
			if (checking) return true;
			editSelectionAsFlashcard(plugin, selection.trim());
			return true;
		},
	});

	plugin.addCommand({
		id: "global-generate-flashcards-from-selection",
		name: "Generate flashcards from selection (any view)",
		checkCallback: (checking) => {
			if (!isPluginEnabled(plugin.settings, "ai-generation")) return false;
			const text = window.getSelection()?.toString().trim();
			if (!text || text.length < 3) return false;
			if (!hasApiKey(plugin)) return false;
			if (checking) return true;
			void generateWithPresetGlobal(
				plugin,
				plugin.settings.defaultGenerationPresetId,
				text,
			);
			return true;
		},
	});

	plugin.addCommand({
		id: "global-quick-add-flashcard-from-selection",
		name: "Quick add flashcard from selection (any view)",
		checkCallback: (checking) => {
			const text = window.getSelection()?.toString().trim();
			if (!text || text.length < 3) return false;
			if (checking) return true;
			void quickAddFlashcardGlobal(plugin, text);
			return true;
		},
	});

	plugin.addCommand({
		id: "global-edit-selection-as-flashcard",
		name: "Edit selection as flashcard (any view)",
		checkCallback: (checking) => {
			const text = window.getSelection()?.toString().trim();
			if (!text || text.length < 3) return false;
			if (checking) return true;
			editSelectionAsFlashcard(plugin, text);
			return true;
		},
	});
}
