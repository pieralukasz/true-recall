/**
 * Plugin Event Handlers
 * Event registrations for file and workspace events
 */
import { Notice, TFile } from "obsidian";
import type EpistemePlugin from "../main";
import { FlashcardPanelView } from "../ui/panel/FlashcardPanelView";
import { VIEW_TYPE_FLASHCARD_PANEL } from "../constants";
import type { CardStore, FSRSCardData, SourceNoteInfo } from "../types";

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

    // Listen for file renames to update source_link
    plugin.registerEvent(
        plugin.app.vault.on("rename", async (file, oldPath) => {
            if (!(file instanceof TFile)) return;
            if (file.extension !== "md") return;

            const frontmatterService = plugin.flashcardManager.getFrontmatterService();
            const uid = await frontmatterService.getSourceNoteUid(file);
            if (!uid) return;

            // Update source_notes table in SQLite with new path and name
            const store = plugin.cardStore as CardStore & {
                updateSourceNotePath?: (uid: string, newPath: string, newName?: string) => void;
            };
            if (store.updateSourceNotePath) {
                store.updateSourceNotePath(uid, file.path, file.basename);
            }
        })
    );

    // Listen for file deletions to clean up orphaned source notes
    plugin.registerEvent(
        plugin.app.vault.on("delete", (file) => {
            if (!(file instanceof TFile) || file.extension !== "md") return;

            // We can't read frontmatter from deleted file, so look up by path
            const store = plugin.cardStore as CardStore & {
                getSourceNoteByPath?: (path: string) => SourceNoteInfo | null;
                deleteSourceNote?: (uid: string, detachCards?: boolean) => void;
                getCardsBySourceUid?: (uid: string) => FSRSCardData[];
            };

            if (store.getSourceNoteByPath && store.deleteSourceNote) {
                const sourceNote = store.getSourceNoteByPath(file.path);
                if (sourceNote) {
                    const cards = store.getCardsBySourceUid?.(sourceNote.uid) ?? [];
                    // Delete source note but keep flashcards (detachCards = false sets source_uid = NULL)
                    store.deleteSourceNote(sourceNote.uid, false);
                    if (cards.length > 0) {
                        new Notice(`Source note deleted. ${cards.length} flashcard(s) are now orphaned.`);
                    }
                }
            }
        })
    );
}

/**
 * Update the panel view with current file
 */
function updatePanelView(plugin: EpistemePlugin, file: TFile | null): void {
    const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_FLASHCARD_PANEL);
    leaves.forEach((leaf) => {
        const view = leaf.view;
        if (view instanceof FlashcardPanelView) {
            void view.handleFileChange(file);
        }
    });
}
