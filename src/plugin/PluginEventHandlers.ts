/**
 * Plugin Event Handlers
 * Event registrations for file and workspace events
 */
import { TFile } from "obsidian";
import type EpistemePlugin from "../main";
import { FlashcardPanelView } from "../ui/panel/FlashcardPanelView";
import { VIEW_TYPE_FLASHCARD_PANEL, FLASHCARD_CONFIG } from "../constants";

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

            const flashcardPath = plugin.flashcardManager.getFlashcardPathByUid(uid);
            const flashcardFile = plugin.app.vault.getAbstractFileByPath(flashcardPath);

            if (flashcardFile instanceof TFile) {
                const content = await plugin.app.vault.read(flashcardFile);
                const updatedContent = frontmatterService.updateSourceLinkInContent(
                    content,
                    file.basename
                );
                if (updatedContent !== content) {
                    await plugin.app.vault.modify(flashcardFile, updatedContent);
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
