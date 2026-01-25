/**
 * Plugin Event Handlers
 * Event registrations for file and workspace events
 *
 * v15: Simplified - no note_projects sync, no source_notes path tracking
 * Projects are read from frontmatter (source of truth)
 */
import { TFile } from "obsidian";
import type EpistemePlugin from "../main";
import { FlashcardPanelView } from "../ui/panel/FlashcardPanelView";
import { VIEW_TYPE_FLASHCARD_PANEL } from "../constants";
import { isImageExtension } from "../types";
import { ImageService } from "../services/image";

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

    // Listen for file renames to update image paths in cards
    plugin.registerEvent(
        plugin.app.vault.on("rename", async (file, oldPath) => {
            if (!(file instanceof TFile)) return;

            // Handle image file renames
            if (isImageExtension(file.extension)) {
                await handleImageRename(plugin, file, oldPath);
            }
            // v15: No longer tracking source note paths in DB
            // Source note lookup is done via flashcard_uid in frontmatter
        })
    );

    // v15: No longer syncing projects from frontmatter to DB on file modify
    // Projects are read from frontmatter at runtime (source of truth)

    // v15: No longer tracking file deletions for source_notes cleanup
    // Source note UIDs remain in DB, cards become orphaned naturally
    // when the source file is gone (lookup by flashcard_uid returns null)
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

/**
 * Handle image file renames - update flashcard content and image refs
 */
async function handleImageRename(plugin: EpistemePlugin, file: TFile, oldPath: string): Promise<void> {
    const store = plugin.cardStore;
    const imageService = new ImageService(plugin.app);

    // Find all cards that reference the old image path
    const cardRefs = store.sourceNotes.getCardsByImagePath(oldPath);
    if (cardRefs.length === 0) {
        return;
    }

    // Update each card's content
    const updatedCardIds = new Set<string>();
    for (const ref of cardRefs) {
        if (updatedCardIds.has(ref.cardId)) continue;

        const card = store.get(ref.cardId);
        if (!card || !card.question || !card.answer) continue;

        // Replace image path in content
        const newQuestion = imageService.replaceImagePath(card.question, oldPath, file.path);
        const newAnswer = imageService.replaceImagePath(card.answer, oldPath, file.path);

        // Update card if content changed
        if (newQuestion !== card.question || newAnswer !== card.answer) {
            store.cards.updateCardContent(ref.cardId, newQuestion, newAnswer);
            updatedCardIds.add(ref.cardId);
        }
    }

    // Update the image_refs table
    store.sourceNotes.updateImagePath(oldPath, file.path);

    if (updatedCardIds.size > 0) {
        console.debug(`[Episteme] Updated ${updatedCardIds.size} card(s) after image rename: ${oldPath} -> ${file.path}`);
    }
}
