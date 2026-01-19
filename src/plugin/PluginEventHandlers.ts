/**
 * Plugin Event Handlers
 * Event registrations for file and workspace events
 */
import { Notice, TFile } from "obsidian";
import type EpistemePlugin from "../main";
import { FlashcardPanelView } from "../ui/panel/FlashcardPanelView";
import { VIEW_TYPE_FLASHCARD_PANEL } from "../constants";
import type { CardStore, FSRSCardData, SourceNoteInfo, CardImageRef } from "../types";
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

    // Listen for file renames to update source_link and image paths
    plugin.registerEvent(
        plugin.app.vault.on("rename", async (file, oldPath) => {
            if (!(file instanceof TFile)) return;

            // Handle markdown file renames (source notes)
            if (file.extension === "md") {
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
                return;
            }

            // Handle image file renames
            if (isImageExtension(file.extension)) {
                await handleImageRename(plugin, file, oldPath);
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

/**
 * Handle image file renames - update flashcard content and image refs
 */
async function handleImageRename(plugin: EpistemePlugin, file: TFile, oldPath: string): Promise<void> {
    const store = plugin.cardStore as CardStore & {
        getCardsByImagePath?: (imagePath: string) => CardImageRef[];
        updateCardContent?: (cardId: string, question: string, answer: string) => void;
        updateImagePath?: (oldPath: string, newPath: string) => void;
        get?: (cardId: string) => FSRSCardData | undefined;
    };

    // Check if store has the required methods
    if (!store.getCardsByImagePath || !store.updateCardContent || !store.updateImagePath || !store.get) {
        return;
    }

    const imageService = new ImageService(plugin.app);

    // Find all cards that reference the old image path
    const cardRefs = store.getCardsByImagePath(oldPath);
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
            store.updateCardContent(ref.cardId, newQuestion, newAnswer);
            updatedCardIds.add(ref.cardId);
        }
    }

    // Update the image_refs table
    store.updateImagePath(oldPath, file.path);

    if (updatedCardIds.size > 0) {
        console.debug(`[Episteme] Updated ${updatedCardIds.size} card(s) after image rename: ${oldPath} -> ${file.path}`);
    }
}
